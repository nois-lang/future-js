type Future<T> = Generator<unknown, T>

type Executor = {
    futures: Future<unknown>[]
}

const executor: Executor = { futures: [] }

const spawn = <T>(future: Future<T>, executor: Executor): Future<T> => {
    executor.futures.push(future)
    return future
}

const run = (executor: Executor): void => {
    setTimeout(() => {
        for (let i = executor.futures.length - 1; i >= 0; i--) {
            const f = executor.futures[i]
            if (f.next().done) {
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
        const { done } = c.next()
        if (done) {
            break
        }
    }
}

const drainAsync = <T>(c: Future<T>): void => {
    setTimeout(() => {
        if (!c.next().done) {
            drainAsync(c)
        }
    })
}

const or = function* <T>(f1: Future<T>, f2: Future<T>): Future<T> {
    while (true) {
        const r1 = f1.next()
        const r2 = f2.next()
        if (r1.done) return r1.value
        if (r2.done) return r2.value
        yield
    }
}

const never = function* (): Future<void> {
    while (true) {
        yield
    }
}

const delay = function* (ms: number): Future<void> {
    const doneBy = performance.now() + ms
    while (doneBy >= performance.now()) {
        yield
    }
}

const fromClosure = function* <T>(fn: (done: (res: T) => void) => void): Generator<any, T> {
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
}

const fromPromise = function* <T>(promise: Promise<T>): Generator<any, T> {
    return yield* fromClosure(done => promise.then(r => done(r)))
}

const longFive = function* (): Future<number> {
    yield* delay(100)
    return 5
}

const bench = function* <T>(gen: Generator<any, T>): Generator<any, T> {
    const start = performance.now()
    const res = yield* gen
    const end = performance.now()
    console.log(`took ${end - start}ms`)
    return res
}

const main = function* () {
    console.log('\nlongFive')
    const n = yield* bench(longFive())
    console.log(n)

    console.log('\ndelay')
    yield* bench(delay(100))

    console.log('\nfromClosure')
    const closureRes = yield* bench(fromClosure(done => setTimeout(() => done('result from closure'), 100)))
    console.log(closureRes)

    console.log('\nfromPromise')
    const resp = yield* bench(fromPromise(fetch('https://google.com')))
    console.log(resp)

    console.log('\nrace')
    const race1 = (function* () {
        yield* delay(50)
        return 50
    })()
    const race2 = (function* () {
        yield* delay(100)
        return 100
    })()

    const res = yield* or(race1, race2)
    console.log(res)

    console.log('\nnever')
    spawn(bench(never()), executor)
}

spawn(main(), executor)
run(executor)
