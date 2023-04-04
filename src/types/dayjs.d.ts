import dayjs, { Dayjs } from "dayjs";

declare module DayjsGas {
  function dayjs(date?: dayjs.ConfigType): Dayjs
}