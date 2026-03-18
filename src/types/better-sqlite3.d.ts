declare module 'better-sqlite3' {
    interface Database {
        prepare(sql: string): Statement;
        exec(sql: string): void;
        close(): void;
        pragma(pragma: string, options?: any): any;
    }
    interface Statement {
        run(...params: any[]): any;
        get(...params: any[]): any;
        all(...params: any[]): any[];
        pluck(toggleState?: boolean): Statement;
    }
    function Database(filename: string, options?: any): Database;
    export = Database;
}
