declare module 'better-sqlite3' {
    interface Statement {
        run(...params: any[]): any;
        get(...params: any[]): any;
        all(...params: any[]): any[];
        pluck(toggleState?: boolean): Statement;
    }

    interface Transaction<T extends (...args: any[]) => any> {
        (...args: Parameters<T>): ReturnType<T>;
    }

    class Database {
        constructor(filename: string, options?: any);
        prepare(sql: string): Statement;
        exec(sql: string): this;
        close(): void;
        pragma(pragma: string, options?: any): any;
        transaction<T extends (...args: any[]) => any>(fn: T): Transaction<T>;
    }

    export = Database;
}
