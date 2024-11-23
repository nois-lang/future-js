type Task<T> = (...any: any[]) => Generator<any, T>

const never = (): Task<void> =>
    function* (): Generator<void> {
        while (true) {
            yield
        }
    }

const delay = (ms: number): Task<number> =>
    function* (): Generator<void, number> {
        const doneBy = performance.now() + ms
        while (doneBy >= performance.now()) {
            yield
        }
        return 5
    }

const longFive: Task<number> = function* () {
    yield* delay(1000)()
    return 5
}

const main = function* () {
    const start = performance.now()

    console.log(0)
    const n = yield* longFive()
    console.log(n)

    const end = performance.now()
    console.log(`took ${end - start}ms`)

    console.log(1)
    yield* delay(1000)()
    console.log(2)
    yield* never()()
}

const run = <T>(task: Task<T>) => {
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
