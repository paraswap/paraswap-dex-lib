import * as log4js from 'log4js';
import * as path from 'path';
import * as util from 'util';

const IS_DEV = true;
const STACK_REGEX = /at (?:(.+)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/;
function parseCallStack(error: Error, skipIdx = 4) {
  const stackLines = error.stack!.split('\n').slice(skipIdx);
  const lineMatch = STACK_REGEX.exec(stackLines[0]);
  if (lineMatch && lineMatch.length === 6) {
    return {
      functionName: lineMatch[1],
      fileName: lineMatch[2].replace(/^.*[\\/](src|dist|app)[\\/]/, ''), // we added replace to get rid of excessive path
      lineNumber: parseInt(lineMatch[3], 10),
      columnNumber: parseInt(lineMatch[4], 10),
      callStack: stackLines.join('\n'),
    };
  }
  return null;
}

function calculateCategory() {
  const parsed = parseCallStack(new Error(), 3);
  return parsed?.fileName.split('.')[0].split(path.sep).join('.');
}

export const ACCESS_LOG_CATEGORY = 'ACCESS-LOG';

const configuration: log4js.Configuration = {
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: IS_DEV
          ? '%[[%d] [%p] [%c] [%f:%l]%] %m%n' // Colored for development
          : '[%d] [%p] [%c] %m%n',
      },
    },
  },
  categories: {
    default: {
      appenders: ['console'],
      level: IS_DEV ? 'trace' : 'info',
      enableCallStack: IS_DEV,
    },
    [ACCESS_LOG_CATEGORY]: {
      appenders: ['console'],
      level: 'info',
    },
  },
};

log4js.configure(configuration);

export const shutdown = () =>
  new Promise<void>(resolve => {
    log4js.shutdown(e => {
      if (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed shutting down log4js', e);
      }
      resolve();
    });
  });
// eslint-disable-next-line no-extend-native
Object.defineProperty(Error.prototype, util.inspect.custom, {
  value: function customErrorInspect() {
    return !IS_DEV || this.isAxiosError === true ? this.toString() : this;
  },
  configurable: true,
  writable: true,
});

export const getLogger = (suffix?: string | number, useAsIs?: boolean) => {
  let category: string | undefined;
  if (useAsIs === true) {
    category = suffix as string;
  } else {
    category = calculateCategory();
    if (suffix) {
      category = `${category}-${suffix}`;
    }
  }
  const logger = log4js.getLogger(category);
  logger.setParseCallStackFunction(parseCallStack); // override to get rid of filename excessive path
  return logger;
};
