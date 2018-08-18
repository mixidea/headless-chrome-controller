import express = require('express');

export class Logger {
  private startTime = Date.now();
  page: any;

  constructor(private res: express.Response) { }

  async log(message: string, capture = false) {
    console.log(message);
    let style = 'font-weight: bold;';
    if (! capture) {
      style = 'font-weight: lighter; font-family: monospace;';
    }
    await this.res.write(`<p><span>${(Date.now() - this.startTime) / 1000}:</span> <span style="${style}">${message}</span></p>`);
    if (capture && this.page && ! this.page.isClosed() ) {
      const img = await this.page.screenshot({encoding: 'base64', fullPage: true});
      await this.res.write(`<img src="data:image/png;base64,${img}" style="border-width:1px; border-style:dashed;">`);
    }
  }
  async error(message: any) {
    console.error(message);
    const style = 'font-weight: lighter; font-family: monospace; color: red;';
    await this.res.write(`<p><span>${(Date.now() - this.startTime) / 1000}:</span> <span style="${style}">${message}</span></p>`);
  }
}
