declare module "sql.js" {
  export interface InitSqlJsConfig {
    locateFile?(file: string, prefix?: string): string;
  }

  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    run(params?: any[]): Statement;
    free(): void;
  }

  export class Database {
    constructor(data?: Uint8Array);
    prepare(sql: string): Statement;
    exec(sql: string): any;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJs {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJs>;
}
