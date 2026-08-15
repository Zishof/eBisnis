export const STATUS_WORK_ORDER=['NEW','TRIAGED','ASSIGNED','IN_PROGRESS','WAITING_PART','WAITING_VENDOR','READY_FOR_INSPECTION','COMPLETED','VERIFIED','CLOSED','CANCELLED','DUPLICATE','DEFERRED'] as const;
export type StatusWorkOrder=typeof STATUS_WORK_ORDER[number];
const FLOW:Record<StatusWorkOrder,readonly StatusWorkOrder[]>={NEW:['TRIAGED','CANCELLED','DUPLICATE'],TRIAGED:['ASSIGNED','DEFERRED','CANCELLED'],ASSIGNED:['IN_PROGRESS','DEFERRED'],IN_PROGRESS:['WAITING_PART','WAITING_VENDOR','READY_FOR_INSPECTION'],WAITING_PART:['IN_PROGRESS'],WAITING_VENDOR:['IN_PROGRESS'],READY_FOR_INSPECTION:['COMPLETED','IN_PROGRESS'],COMPLETED:['VERIFIED','IN_PROGRESS'],VERIFIED:['CLOSED'],CLOSED:[],CANCELLED:[],DUPLICATE:[],DEFERRED:['TRIAGED']};
export function transisiWorkOrderDiizinkan(from:StatusWorkOrder,to:StatusWorkOrder){return FLOW[from].includes(to);}
export function slaDueAt(createdAt:Date,priority:string){const minutes=priority==='CRITICAL'?30:priority==='HIGH'?120:priority==='LOW'?1440:480;return new Date(createdAt.getTime()+minutes*60_000);}

