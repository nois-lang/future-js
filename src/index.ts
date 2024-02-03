export type State<T> = { type: 'created' | 'queued' | 'pending' } | { type: 'resolved'; result: T }

export type FlatFuture<T> = T extends Future<infer U> ? U : T

export class Future<T> {
    constructor(
        public fn: (done: (result: T) => void) => void,
        public subscribers: ((result: T) => void)[] = [],
        public state: State<T> = { type: 'created' }
    ) {}

    onComplete(fn: (result: T) => void): Future<T> {
        if (this.state.type === 'resolved') {
            fn(this.state.result)
            return this
        }
        if (this.state.type === 'created') {
            this.spawn()
        }
        this.subscribers.push(fn)
        return this
    }

    map<U>(fn: (result: T) => U): Future<U> {
        return new Future(done => this.onComplete(res => done(fn(res))))
    }

    flatMap<U>(fn: (result: T) => Future<U>): Future<U> {
        return new Future(done => this.map(fn).flat().onComplete(done))
    }

    flat(): Future<FlatFuture<T>> {
        return new Future(done =>
            this.onComplete(res => {
                if (res instanceof Future) {
                    res.onComplete(r => done(r))
                } else {
                    done(<FlatFuture<T>>res)
                }
            })
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
            future.state = { type: 'pending' }
            this.pending.push(future)
            future.fn(res => {
                future.state = { type: 'resolved', result: res }
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
        future.state = { type: 'queued' }
    }

    cancel(future: Future<any>): void {
        if (future.state.type === 'queued') {
            this.queue.splice(this.queue.indexOf(future), 1)
        }
        if (future.state.type === 'pending') {
            this.pending.splice(this.pending.indexOf(future), 1)
        }
    }
}
export const runtime = new Runtime()

const delay = (ms: number): Future<void> => new Future(res => setTimeout(() => res(), ms))

new Future<void>(done => {
    main()
    done()
}).spawn()
runtime.loop()

async function main() {
    console.log('start')
    const a = delay(500).onComplete(() => console.log('one'))
    const b = a.flatMap(() => delay(500)).onComplete(() => console.log('two'))
    b.map(() => 5).onComplete(res => console.log('three', res))
}
