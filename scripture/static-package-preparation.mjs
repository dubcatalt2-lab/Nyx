// Asset uploads can outlast an HTTP request. Keep their Git objects in flight;
// only the original publisher is allowed to commit them to a branch.
export class StaticPackagePreparation {
  constructor({ waitMs = 1500 } = {}) { this.jobs = new Map(); this.waitMs = waitMs; }
  async get(key, prepare) {
    let job = this.jobs.get(key);
    if (!job) {
      if (this.jobs.size >= 8) throw Object.assign(Error('Static publishing is busy. Try again shortly.'), { status: 503, retryAfter: 30 });
      job = {};
      job.promise = Promise.resolve().then(prepare).then(value => ({ value }), error => ({ error }));
      this.jobs.set(key, job);
    }
    let timer;
    const result = await Promise.race([job.promise, new Promise(resolve => { timer = setTimeout(() => resolve(null), this.waitMs); })]);
    clearTimeout(timer);
    if (!result) throw Object.assign(Error('Preparing the static Nyx app. The first publish can take a few minutes.'), { status: 429, code: 'STATIC_PACKAGE_PREPARING', retryAfter: 10 });
    this.jobs.delete(key);
    if (result.error) throw result.error;
    return result.value;
  }
}
