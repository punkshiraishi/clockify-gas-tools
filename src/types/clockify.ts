type DetailedReportType = {
  totals: {
    totalTime: number,
    totalBillableTime: number,
    entriesCount: number,
    totalAmount: number
  }[],
  timeentries: TimeentryType[]
}

type TimeentryType = {
    _id: string,
    description: string,
    userId: string,
    billable: boolean,
    taskId: string,
    projectId: string,
    clientId: string,
    timeInterval: {
      start: string,
      end: string,
      duration: number,
    },
    approvalRequestId: string,
    tags: string[],
    isLocked: boolean,
    customFields: {
      customFieldId: string,
      value: string,
    }[],
    amount: number,
    rate: number,
    userName: string,
    userEmail: string,
    projectName: string,
    projectColor: string,
    clientName: string,
}

export {
  DetailedReportType,
  TimeentryType,
}