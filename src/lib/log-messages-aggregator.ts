import { Logger, LogLevels } from '../types';
import { getLogger } from './log4js';

export const DEFAULT_LOG_PUBLISH_PERIOD_MS = 5_000;

export type MessageData = {
  message: string;
  logLevel: LogLevels;
  counter: number;
  identificationInfos?: string[];
};

export type AggregatedLogs = {
  [entityName in string]: Record<string, MessageData>;
};

export class LogMessagesAggregator {
  private logger: Logger;

  private _aggregatedLogs: AggregatedLogs = {};

  private _intervalTimer?: NodeJS.Timer;

  constructor() {
    this.logger = getLogger('LogMessageAggregator');
  }

  logMessage(
    entityName: string,
    msg: string,
    level: LogLevels,
    identificationInfo?: string,
  ) {}

  private _publishLogs() {
    for (const [entityName, logMessages] of Object.entries(
      this._aggregatedLogs,
    )) {
      for (const [messageKey, messageData] of Object.entries(logMessages)) {
        this.logger[messageData.logLevel](
          this._formatLogMessage(messageData, entityName),
        );
        delete logMessages[messageKey];
      }
    }
  }

  private _formatLogMessage(messageData: MessageData, entityName: string) {
    const { counter, message, identificationInfos } = messageData;
    const identities =
      identificationInfos === undefined
        ? ''
        : ` for entities: ${identificationInfos.join(',')}`;
    return `${entityName}: logged ${counter} occurrences of: "${message}"${identities}`;
  }

  init(publishLogPeriodMs: number = DEFAULT_LOG_PUBLISH_PERIOD_MS) {
    if (this._intervalTimer === undefined) {
      this._intervalTimer = setInterval(
        this._publishLogs.bind(this),
        publishLogPeriodMs,
      );
    }
  }

  releaseResources() {
    if (this._intervalTimer) {
      clearInterval(this._intervalTimer);
      this._intervalTimer = undefined;
    }
  }

  private _clearMessageData(messageData: MessageData) {
    messageData.counter = 0;
    if (messageData.identificationInfos) {
      messageData.identificationInfos.length = 0;
    }
  }
}

export const logMessagesAggregator = new LogMessagesAggregator();
