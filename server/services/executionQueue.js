export class ExecutionQueue {
  constructor(concurrency = 1, maxPending = 30) {
    this.concurrency = concurrency;
    this.maxPending = maxPending;
    this.active = 0;
    this.pending = [];
  }
  run(task, signal) {
    return new Promise((resolve, reject) => {
      const item = { task, resolve, reject, signal };
      if (this.pending.length >= this.maxPending) {
        reject(
          Object.assign(
            new Error(
              "Fila de processamento cheia. Tente novamente em instantes.",
            ),
            { status: 429 },
          ),
        );
        return;
      }
      const abort = () => {
        const index = this.pending.indexOf(item);
        if (index >= 0) {
          this.pending.splice(index, 1);
          reject(
            Object.assign(new Error("Cancelado."), { name: "AbortError" }),
          );
        }
      };
      item.abort = abort;
      signal?.addEventListener("abort", abort, { once: true });
      this.pending.push(item);
      this.drain();
    });
  }
  drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const item = this.pending.shift();
      item.signal?.removeEventListener("abort", item.abort);
      if (item.signal?.aborted) {
        item.reject(
          Object.assign(new Error("Cancelado."), { name: "AbortError" }),
        );
        continue;
      }
      this.active++;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}
