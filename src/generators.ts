type Future<T> = { gen: Generator<unknown, T> }

const future = <T, R>(f: () => Generator<T, R>): Future<R> => ({ gen: genMemo(f()) })

type Executor = {
    futures: Future<unknown>[]
}

const executor: Executor = { futures: [] }

/**
 * Upon calling {@link Generator.next()}
 */
const genMemo = <T, R>(generator: Generator<T, R>): Generator<T, R> => {
    let lastValue: T | R | undefined
    let done = false

    return {
        next(...args: [] | [T]): IteratorResult<T, R> {
            if (done) {
                return { value: lastValue as R, done: true }
            }

            const result = generator.next(...args)
            done = result.done!
            if (done && lastValue === undefined) {
                lastValue = result.value
                return { done, value: lastValue as R }
            }
            return result
        },
        return(_v: R): IteratorResult<T, R> {
            throw Error('return')
        },
        throw(e: any): IteratorResult<T, R> {
            throw e
        },
        [Symbol.iterator]() {
            return this
        }
    }
}

const spawn = <T>(future: Future<T>, executor: Executor): Future<T> => {
    executor.futures.push(future)
    return future
}

const run = (executor: Executor): void => {
    setTimeout(() => {
        for (let i = executor.futures.length - 1; i >= 0; i--) {
            const f = executor.futures[i]
            if (f.gen.next().done) {
                executor.futures.splice(i, 1)
            }
        }
        if (executor.futures.length > 0) {
            run(executor)
        }
    })
}

// WARN: {@link fromClosure} and {@link fromPromise} won't work with this since while loop is
// blocking the main thread
const drain = <T>(c: Future<T>): void => {
    while (true) {
        const { done } = c.gen.next()
        if (done) {
            break
        }
    }
}

const drainAsync = <T>(c: Future<T>): void => {
    setTimeout(() => {
        if (!c.gen.next().done) {
            drainAsync(c)
        }
    })
}

/**
 * TODO: cancellation
 */
const or = <T>(f1: Future<T>, f2: Future<T>): Future<T> =>
    future(function* () {
        while (true) {
            const r1 = f1.gen.next()
            const r2 = f2.gen.next()
            if (r1.done) return r1.value
            if (r2.done) return r2.value
            yield
        }
    })

const map = <T, U>(fut: Future<T>, f: (value: T) => U): Future<U> =>
    future(function* () {
        return f(yield* fut.gen)
    })

const flatMap = <T, U>(fut: Future<T>, f: (value: T) => Future<U>): Future<U> =>
    future(function* () {
        return yield* f(yield* fut.gen).gen
    })

const never = () =>
    future(function* () {
        while (true) {
            yield
        }
    })

const delay = (ms: number): Future<void> =>
    future(function* () {
        const doneBy = performance.now() + ms
        while (doneBy >= performance.now()) {
            yield
        }
    })

const fromClosure = <T>(fn: (done: (res: T) => void) => void): Future<T> =>
    future(function* () {
        let done = false
        let result: T | undefined
        fn(r => {
            done = true
            result = r
        })
        while (!done) {
            yield
        }
        return result!
    })

const fromPromise = <T>(promise: Promise<T>): Future<T> =>
    future(function* () {
        return yield* fromClosure<T>(done => promise.then(r => done(r))).gen
    })

const longFive = (): Future<number> =>
    future(function* () {
        yield* delay(100).gen
        return 5
    })

const bench = <T>(f: Future<T>): Future<T> =>
    future(function* () {
        const start = performance.now()
        const res = yield* f.gen
        const end = performance.now()
        console.log(`took ${end - start}ms`)
        return res
    })

const main = future(function* () {
    console.log('\nlongFive')
    const n = yield* bench(longFive()).gen
    console.log(n)

    console.log('\ndelay')
    yield* bench(delay(100)).gen

    console.log('\nfromClosure')
    const closureRes = yield* bench(fromClosure(done => setTimeout(() => done('result from closure'), 100))).gen
    console.log(closureRes)

    console.log('\nfromPromise + map')
    const resp = yield* bench(map(fromPromise(fetch('https://google.com')), r => r.status)).gen
    console.log(resp)

    console.log('\nfromPromise + flatMap')
    const body = yield* bench(flatMap(fromPromise(fetch('https://google.com')), r => fromPromise(r.text()))).gen
    console.log(body.length)

    console.log('\nrace')
    const race1 = spawn(
        future(function* () {
            yield* delay(50).gen
            return 50
        }),
        executor
    )
    const race2 = spawn(
        future(function* () {
            yield* delay(100).gen
            return 100
        }),
        executor
    )

    const res = yield* bench(or(race1, race2)).gen
    console.log(res)

    console.log('\nnever')
    spawn(bench(never()), executor)
})

spawn(main, executor)
run(executor)
