// import { Logger, LogLevels } from '../types';

// export const DEFAULT_LOG_PUBLISH_PERIOD_MS = 60_000;

// export type StandardStringEnum = {
//   [id: string]: string;
// };

// export type MessageInfo = {
//   key: keyof StandardStringEnum;
//   message: StandardStringEnum[keyof StandardStringEnum];
//   logLevel: LogLevels;
//   logger: Logger;
// };

// export type MessageData = {
//   messageKey: keyof StandardStringEnum;
//   counter: number;
//   identificationInfos?: string[];
// };

// export type AggregatedLogForEntity = Record<
//   keyof StandardStringEnum,
//   MessageData
// >;

// export type AggregatedLogs = {
//   [entityName in string]: AggregatedLogForEntity;
// };

// export class LogMessagesSuppressor {
//   static instances: Record<string, LogMessagesSuppressor> = {};

//   private _aggregatedLogs: AggregatedLogs = {};

//   private _intervalTimer?: NodeJS.Timer;

//   private _allMessages: Record<keyof StandardStringEnum, MessageInfo> = {};

//   constructor(readonly entityName: string, allMessagesInfo: MessageInfo[]) {
//     for (const messageInfo of allMessagesInfo) {
//       this._allMessages[messageInfo.key] = messageInfo;
//     }
//   }

//   getSuppressorInstance(entityName: string, allMessagesInfo: MessageInfo[]) {
//     const instance = LogMessagesSuppressor.instances[entityName];
//     if (instance === undefined) {
//       LogMessagesSuppressor.instances[entityName] = new LogMessagesSuppressor(
//         entityName,
//         allMessagesInfo,
//       );
//     }
//     return LogMessagesSuppressor.instances[entityName];
//   }

//   logMessage(
//     msgKey: keyof StandardStringEnum,
//     identificationInfo: string = '',
//     ...args: unknown[]
//   ) {
//     const entityMsgRepository = this._aggregatedLogs[this.entityName];
//     if (entityMsgRepository[msgKey] === undefined) {
//       const msgInfo = this._allMessages[msgKey];
//     }
//   }

//   private _publishLogs() {
//     for (const [entityName, logMessages] of Object.entries(
//       this._aggregatedLogs,
//     )) {
//       for (const [messageKey, messageData] of Object.entries(logMessages)) {
//         this.logger[messageData.logLevel](
//           this._formatLogMessage(messageData, entityName),
//         );
//         delete logMessages[messageKey];
//       }
//     }
//   }

//   private _formatLogMessage(messageData: MessageData, entityName: string) {
//     const { counter, message, identificationInfos } = messageData;
//     const identities =
//       identificationInfos === undefined
//         ? ''
//         : ` for entities: ${identificationInfos.join(',')}`;
//     return `${entityName}: logged ${counter} occurrences of: "${message}"${identities}`;
//   }

//   init(publishLogPeriodMs: number = DEFAULT_LOG_PUBLISH_PERIOD_MS) {
//     if (this._intervalTimer === undefined) {
//       this._intervalTimer = setInterval(
//         this._publishLogs.bind(this),
//         publishLogPeriodMs,
//       );
//     }
//   }

//   releaseResources() {
//     if (this._intervalTimer) {
//       clearInterval(this._intervalTimer);
//       this._intervalTimer = undefined;
//     }
//   }

//   private _clearMessageData(messageData: MessageData) {
//     messageData.counter = 0;
//     if (messageData.identificationInfos) {
//       messageData.identificationInfos.length = 0;
//     }
//   }
// }
