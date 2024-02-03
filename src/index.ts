export type Result<T, E> = { type: 'ok'; value: T } | { type: 'error'; value: E }

export type Status = 'created' | 'queued' | 'pending' | 'done'

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

    flatMap<U>(fn: (result: T) => Future<U>): Future<U> {
        return new Future(done =>
            this.onComplete(res =>
                fn(res)
                    .spawn()
                    .onComplete(r => done(r))
            )
        )
    }

    spawn(): Future<T> {
        runtime.spawn(this)
        return this
    }
}

export class Runtime {
    queue: Future<any>[] = []
    pending: Future<any>[] = []

    constructor(public pollingRate: number = 5) {}

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
            setTimeout(() => this.loop(), this.pollingRate)
        }
    }

    spawn(future: Future<any>): void {
        this.queue.push(future)
        future.status = 'queued'
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
    console.log('start')
    const a = delay(500)
        .spawn()
        .onComplete(() => console.log('one'))
    const b = a
        .flatMap(() => delay(500))
        .spawn()
        .onComplete(() => console.log('two'))
    b.map(() => 5)
        .spawn()
        .onComplete(res => console.log('three', res))
}
