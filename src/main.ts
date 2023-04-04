import { DetailedReportType, TimeentryType } from "./types/clockify";
import { DayjsGas } from "./types/dayjs";
import { Lodash } from "./types/lodash";
import { Samples } from "./types/samples";

const _ = Lodash.load()
const dayjs = DayjsGas.dayjs

function doGet(e) {
  const {
    clockifyAccessToken,
    clockifyWorkspace,
    type = 'daily',
    min = 0,
    start,
    end,
    gitlabToken,
    defaultProject,
  } = e.parameter

  let template: GoogleAppsScript.HTML.HtmlTemplate;

  const today = dayjs()

  if (type === 'daily' || type === 'weekly' || type === 'search') {
    let startDate = start;
    let endDate = end;
    let title: string;
  
    if (type === 'daily') {
      startDate = dayjs(today).format('YYYY-MM-DD')
      endDate = dayjs(today).add(1, 'day').format('YYYY-MM-DD')
      title = '日報'

    } else if (type === 'weekly') {
      startDate = getMonday(today).format('YYYY-MM-DD')
      endDate = getMonday(today).add(5, 'day').format('YYYY-MM-DD')
      title = '週報'
    } 

    let formattedTimeentries = '';
    let error = '';

    if(clockifyAccessToken && clockifyWorkspace) {
      try {
        formattedTimeentries = formatTimeentries(groupTimeentries(
          getClockifyReport(clockifyAccessToken, clockifyWorkspace, new Date(startDate), new Date(endDate)).timeentries, min
        ))

      } catch {
        error = 'Clockify Access Token または Workspace Id が間違っている可能性があります。';
      }
    }

    template = HtmlService.createTemplateFromFile("pages/daily");
    template.clockifyWorkspace = clockifyWorkspace;
    template.clockifyAccessToken = clockifyAccessToken;
    template.start = startDate;
    template.end = endDate;
    template.min = min;
    template.summary = formattedTimeentries;
    template.error = error;

    return template.evaluate().setTitle(title).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  } else if (type === 'gitlab') {
    template = HtmlService.createTemplateFromFile("pages/gitlab");
    template.gitlabToken = gitlabToken
    template.defaultProject = defaultProject
    template.report = groupTimeentries(
      getClockifyReport(
        clockifyAccessToken,
        clockifyWorkspace,
        new Date(dayjs(today).format('YYYY-MM-DD')),
        new Date(dayjs(today).add(1, 'day').format('YYYY-MM-DD'))
      ).timeentries, 
      min
    )

    return template.evaluate().setTitle('spend管理');

  }
}

function groupTimeentries(timeentries: TimeentryType[], min: number) {
  return _.chain(timeentries)
    .groupBy('clientName')
    .mapValues(entries => {
      return _.chain(entries)
        .groupBy('projectName')
        .mapValues(items => {
          return _.chain(items)
            .groupBy('description')
            .mapValues(values => {
              return values
                .reduce((previous, current) => {
                  return {
                    ...previous,
                    timeInterval: {
                      start: _.min([previous.timeInterval.start, current.timeInterval.start]),
                      end: _.max([previous.timeInterval.end, current.timeInterval.end]),
                      duration: previous.timeInterval.duration + current.timeInterval.duration,
                    },
                  }
                })
            })
            .pickBy(value => value.timeInterval.duration > min * 3600)
            .value()
        })
        .pickBy(value => Object.entries(value).length > 0)
        .value()
    })
    .pickBy(value => Object.entries(value).length > 0)
    .value()
}

function formatTimeentries(groupedTimeentries: ReturnType<typeof groupTimeentries>) {
  let output: string[] = [];

  const formatToHour = (num) => {
    return (Math.round(num / 3600 * 100) / 100).toFixed(1)
  }

  _.chain(groupedTimeentries)
    .entries()
    .forEach(item => {
      output.push(`\n■ ${item[0]}`)
      _.chain(item[1])
        .entries()
        .forEach(item => {
          output.push(`【${item[0]}】`)
          _.chain(item[1])
            .entries()
            .sortBy(item => item[1].timeInterval.duration)
            .reverse()
            .forEach(item => {
              output.push(`　┗ ${formatToHour(item[1].timeInterval.duration)} h ${item[0]}`)
            })
            .value()
        })
        .value()
    })
    .value()
  
  return output.join('\n')
}

function testDailyFormatting() {
  const expected0 = "\n■ BC4L\n【桜缶】\n　┗ 1.8 h #461 問い合わせID対応\n　┗ 1.4 h #390 本番キャンペーン設定\n　┗ 1.1 h #432 本番プログラムコンテント設定\n　┗ 0.5 h タスク整理\n　┗ 0.2 h #472 遷移制御の微修正\n【CMS】\n　┗ 0.9 h チーム内レビュー\n【チームミーティング】\n　┗ 1.1 h 定例\n　┗ 0.3 h 朝会\n\n■ 品質 WG\n【作業】\n　┗ 1.5 h BCチーム 品質ヒアリング\n　┗ 0.9 h 効率化ツール作成\n　┗ 0.2 h chromatic 提案資料作成\n\n■ UV\n【その他】\n　┗ 0.1 h 朝会"
  const expected1 = "\n■ BC4L\n【桜缶】\n　┗ 1.8 h #461 問い合わせID対応\n　┗ 1.4 h #390 本番キャンペーン設定\n　┗ 1.1 h #432 本番プログラムコンテント設定\n【チームミーティング】\n　┗ 1.1 h 定例\n\n■ 品質 WG\n【作業】\n　┗ 1.5 h BCチーム 品質ヒアリング"
  const expected2 = ""
  log(formatTimeentries(groupTimeentries(Samples.report.timeentries, 0)) === expected0)
  log(formatTimeentries(groupTimeentries(Samples.report.timeentries, 1)) === expected1)
  log(formatTimeentries(groupTimeentries(Samples.report.timeentries, 2)) === expected2)
}

function getMonday(date) {
  return dayjs(date).add(1 - dayjs(date).day(), 'day')
}

function getClockifyReport(token: string, workspace: string, dateRangeStart: Date, dateRangeEnd: Date): DetailedReportType {
  const url = `https://reports.api.clockify.me/v1/workspaces/${workspace}/reports/detailed`;
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      dateRangeStart,
      dateRangeEnd,
      detailedFilter: {
        page: 1,
        pageSize: 1000,
      },
    }),
    headers: {
      "X-Api-Key": token
    }
  }
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();

  return JSON.parse(json);
}

function spendIssue(token: string, project: string, issue: string, spend: number) {
  const url = `https://gitlab.com/api/v4/projects/${project}/issues/${issue}/add_spent_time?duration=${spend}h`;
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "PRIVATE-TOKEN": token
    }
  }
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  return json
}

function testSpendIssue() {
  const res = spendIssue(process.env["GITLAB_TOKEN"], "33665856", "1", 1)
  log(res)
}

function log(log) {
  console.log(JSON.stringify(log, null , "\t"))
}

