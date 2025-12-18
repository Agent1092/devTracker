declare module "better-sqlite3" {
  export interface Statement {
    run(...params: any[]): any;
    all(...params: any[]): any[];
    get(...params: any[]): any;
  }

  export default class Database {
    constructor(filename: string, options?: any);
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(sql: string, options?: any): any;
  }
}
