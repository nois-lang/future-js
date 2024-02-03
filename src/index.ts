export type Result<T, E> = { type: 'ok'; value: T } | { type: 'error'; value: E }

export type Status = 'created' | 'pending' | 'done'

export class Future<T> {
    constructor(
        public fn: (done: (result: T) => void) => void,
        public thenFn?: (result: T) => void,
        public status: Status = 'created'
    ) {}

    map(mapFn: (result: T) => void): Future<T> {
        this.thenFn = mapFn
        return this
    }
}

export class Runtime {
    private queue: Future<any>[] = []
    private pending: Future<any>[] = []

    loop(): void {
        if (this.queue.length !== 0) {
            const future = this.queue.splice(0, 1)[0]
            future.status = 'pending'
            this.pending.push(future)
            future.fn(res => {
                future.thenFn?.(res)
                future.status = 'done'
                this.pending.splice(this.pending.indexOf(future), 1)
            })
        }
        if (this.queue.length !== 0 || this.pending.length !== 0) {
            setTimeout(() => this.loop(), 10)
        }
    }

    spawn(future: Future<any>): void {
        this.queue.push(future)
    }
}
export const runtime = new Runtime()

runtime.spawn(
    new Future<void>(done => {
        main()
        done()
    })
)
runtime.loop()

function main() {
    console.log('Hello, World!')
    const f = new Future(res => setTimeout(() => res(5), 1000)).map(res => console.log('res', res))
    runtime.spawn(f)
}
