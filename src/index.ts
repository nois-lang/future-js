export type Result<T, E> = { type: 'ok'; value: T } | { type: 'error'; value: E }

export type Status = 'created' | 'pending' | 'done'

export class Future<T> {
    constructor(
        public fn: (done: (result: T) => void) => void,
        public subscribers: ((result: T) => void)[] = [],
        public status: Status = 'created'
    ) {}

    onComplete(fn: (result: T) => void): Future<T> {
        this.subscribers.push(fn)
        return this
    }

    map<U>(fn: (result: T) => U): Future<U> {
        return new Future(done => this.onComplete(res => done(fn(res))))
    }

    spawn(): Future<T> {
        runtime.spawn(this)
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
                future.status = 'done'
                for (const s of future.subscribers) {
                    s(res)
                }
                future.subscribers.length = 0
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

const delay = (ms: number): Future<void> => new Future(res => setTimeout(() => res(), ms))

new Future<void>(done => {
    main()
    done()
}).spawn()
runtime.loop()

function main() {
    console.log('Hello, World!')
    const f = delay(1000).spawn()
    f.map(() => 5)
        .onComplete(res => console.log('res', res))
        .spawn()
}
