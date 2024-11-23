type Future<T> = (...any: any[]) => Generator<any, T>

const never = (): Future<void> =>
    function* (): Generator<void> {
        while (true) {
            yield
        }
    }

const delay = (ms: number): Future<number> =>
    function* (): Generator<void, number> {
        const doneBy = performance.now() + ms
        while (doneBy >= performance.now()) {
            yield
        }
        return 5
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

const longFive: Future<number> = function* () {
    yield* delay(1000)()
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
    yield* bench(delay(1000)())

    console.log('\nfromClosure')
    const res = yield* bench(fromClosure(done => setTimeout(() => done('result from closure'), 1000)))
    console.log(res)

    console.log('\nfromPromise')
    const resp = yield* bench(fromPromise(fetch('https://google.com')))
    console.log(resp)

    console.log('\nnever')
    yield* bench(never()())
}

const run = <T>(task: Future<T>) => {
    const execution = task()
    drainAsync(execution)
}

const drainAsync = <T>(gen: Generator<T>) => {
    setTimeout(() => {
        const { done } = gen.next()
        if (!done) {
            drainAsync(gen)
        }
    })
}

run(main)
