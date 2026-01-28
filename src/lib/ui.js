import ora from 'ora';
import chalk from 'chalk';

export const ui = {
  /**
   * Creates and returns a spinner instance.
   * @param {string} text 
   * @returns {import('ora').Ora}
   */
  spinner(text) {
    return ora(text);
  },

  /**
   * Colors text green.
   * @param {string} text 
   * @returns {string}
   */
  success(text) {
    return chalk.green(text);
  },

  /**
   * Colors text red.
   * @param {string} text 
   * @returns {string}
   */
  error(text) {
    return chalk.red(text);
  },

  /**
   * Colors text yellow.
   * @param {string} text 
   * @returns {string}
   */
  warn(text) {
    return chalk.yellow(text);
  },

  /**
   * Colors text blue/cyan for info.
   * @param {string} text 
   * @returns {string}
   */
  info(text) {
    return chalk.cyan(text);
  },

  /**
   * Bold text.
   * @param {string} text 
   * @returns {string}
   */
  bold(text) {
    return chalk.bold(text);
  },
  
  /**
   * Colors text gray.
   * @param {string} text 
   * @returns {string}
   */
  dim(text) {
    return chalk.gray(text);
  }
};
