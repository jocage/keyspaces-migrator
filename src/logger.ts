import chalk from 'chalk';

export class Logger {
  private static instance: Logger;
  private verbose: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('🐛'), message);
    }
  }

  table(data: Array<Record<string, any>>): void {
    if (data.length === 0) {
      this.info('No data to display');
      return;
    }

    const headers = Object.keys(data[0]);
    const maxWidths = headers.map(header =>
      Math.max(
        header.length,
        ...data.map(row => String(row[header] || '').length)
      )
    );

    // Print header
    const headerRow = headers
      .map((header, i) => header.padEnd(maxWidths[i]))
      .join(' | ');
    console.log(chalk.bold(headerRow));
    console.log(headers.map((_, i) => '-'.repeat(maxWidths[i])).join('-+-'));

    // Print rows
    data.forEach(row => {
      const dataRow = headers
        .map((header, i) => String(row[header] || '').padEnd(maxWidths[i]))
        .join(' | ');
      console.log(dataRow);
    });
  }
}
