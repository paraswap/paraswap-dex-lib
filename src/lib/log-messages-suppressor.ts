import { assert } from 'ts-essentials';
import _ from 'lodash';
import { Logger, LogLevels } from '../types';
import { Utils } from '../utils';

export const DEFAULT_LOG_PUBLISH_PERIOD_MS = 60_000;

// After this period previous logs, even if unpublished, would be discarded
// Because most likely they are outdated
export const DEFAULT_LOG_DISCARD_PERIOD_MS = 15 * 60 * 1000;

// We may have hundreds of pools failing at the same time,
// and we don't want to show them all
export const DEFAULT_LOG_MAX_IDENTITIES_TO_SHOW = 10;

export type StandardStringEnum = Readonly<Record<string, string>>;

export type MessageInfo<T extends StandardStringEnum> = {
  key: keyof T;
  message: T[keyof T];
  logLevel: LogLevels;
};

export type MessageData = {
  counter: number;
  lastLoggedAtMs: number;
  identificationInfos: string[];
};

export type AggregatedLogForEntity<T extends StandardStringEnum> = {
  [key in keyof T]?: MessageData;
};

/*
 * This is helper module to reduce frequency of logging of spamming messages
 *
 * 1. You can only have predefined set of log messages to log
 * First time log message is received, it is published with all arguments.
 * Limitation - message can not include variables, but you can pass them as args
 * If within cooldown period received another message of the same category, it
 * is not published, but counter is increased with addition of some entity identifier
 *
 * 2. There is no background task running. In order to keep relevance of logs,
 * if after certain amount of time we didn't receive logs, then we discarded accumulated ones
 * on the next received ones and only publish relevant ones
 */

export class LogMessagesSuppressor<T extends StandardStringEnum> {
  // I don't really like this any, but couldn't come up with better solution
  // in reasonable time. So, in order to unblock myself, do this
  static instances: Record<string, LogMessagesSuppressor<any>> = {};

  private _aggregatedLogs: AggregatedLogForEntity<T> = {};

  constructor(
    readonly entityName: string,
    private _allMessages: Record<keyof T, MessageInfo<T>>,
    protected logger: Logger,
  ) {}

  static getLogSuppressorInstance<T extends StandardStringEnum>(
    entityName: string,
    allMessages: Record<keyof T, MessageInfo<T>>,
    logger: Logger,
  ) {
    const instance = LogMessagesSuppressor.instances[entityName];
    if (instance === undefined) {
      LogMessagesSuppressor.instances[entityName] =
        new LogMessagesSuppressor<T>(entityName, allMessages, logger);
    } else {
      assert(
        _.isEqual(allMessages, instance._allMessages),
        'getLogSuppressorInstance: try to get existing instance with different allMessagesInfo',
      );
      assert(
        _.isEqual(logger, instance.logger),
        'getLogSuppressorInstance: try to get existing instance with different logger',
      );
    }
    return LogMessagesSuppressor.instances[entityName];
  }

  logMessage(
    msgKey: keyof T,
    identificationInfo: string = '',
    ...args: unknown[]
  ) {
    const msgInfo = this._allMessages[msgKey];
    assert(
      msgInfo !== undefined,
      `Used unrecognized msgKey=${String(msgKey)} to get msgInfo`,
    );

    if (this._aggregatedLogs[msgKey] === undefined) {
      this._aggregatedLogs[msgKey] = {
        counter: 0,
        identificationInfos:
          identificationInfo === '' ? [] : [identificationInfo],
        lastLoggedAtMs: 0,
      };
    }
    const msgData = this._aggregatedLogs[msgKey];
    assert(
      msgData !== undefined,
      `msgData is undefined for msgKey=${String(msgKey)}`,
    );

    const nowMs = Date.now();

    const elapsedSinceLastPublish = nowMs - msgData.lastLoggedAtMs;

    if (elapsedSinceLastPublish > DEFAULT_LOG_PUBLISH_PERIOD_MS) {
      // Accumulated logs are too old to have any relevance, so better to discard them
      if (elapsedSinceLastPublish > DEFAULT_LOG_DISCARD_PERIOD_MS) {
        this._clearMessageData(msgData);
      }

      // Make actual logging
      // Logging is done using original logger of the entity to keep module info
      // and not override it
      this.logger[msgInfo.logLevel](
        this._formatLogMessage(msgData, msgInfo.message, args),
      );
      this._clearMessageData(msgData);
    } else {
      msgData.counter++;
      if (identificationInfo !== '') {
        msgData.identificationInfos.push(identificationInfo);
      }
    }
  }

  private _formatLogMessage(
    msgData: MessageData,
    message: string,
    args: unknown[],
  ) {
    const { counter, identificationInfos } = msgData;
    let identities =
      identificationInfos && identificationInfos.length === 0
        ? ''
        : ` for entities: ${
            identificationInfos.length > DEFAULT_LOG_MAX_IDENTITIES_TO_SHOW
              ? identificationInfos
                  .slice(DEFAULT_LOG_MAX_IDENTITIES_TO_SHOW)
                  .join(',')
              : identificationInfos.join(',')
          }`;

    if (
      identificationInfos &&
      identificationInfos.length > DEFAULT_LOG_MAX_IDENTITIES_TO_SHOW
    ) {
      identities = `${identities}... ${identificationInfos.length} total`;
    }
    const argsFormatted =
      args.length > 0
        ? ` with args: ${args.map(a => Utils.Serialize(a)).join('.')}`
        : '';
    return `Logged ${counter} occurrences of: "${message}"${identities}${argsFormatted}`;
  }

  private _clearMessageData(messageData: MessageData) {
    messageData.counter = 0;
    if (messageData.identificationInfos) {
      messageData.identificationInfos.length = 0;
    }
    messageData.lastLoggedAtMs = Date.now();
  }
}
