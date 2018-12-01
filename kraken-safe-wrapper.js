const KrakenClient = require('kraken-api')
const AutoDecCounter = require('auto-dec-counter')
const debug = require('debug')('kraken-safe-wrapper:debug')
const info = require('debug')('kraken-safe-wrapper:info')

class KrakenSafeWrapper {
  constructor({key, secret, maxTries=1, counterDecIntervalMs=3000, counterLimit=10}) {
    this.client = new KrakenClient(key, secret)
    this.maxTries = maxTries
    this.counter = new AutoDecCounter(counterDecIntervalMs)
    this.counterLimit = counterLimit
  }

  async overloadProtectedApiCall(...args) {
    debug('api call', args)
    await this.counter.waitDropTo(this.counterLimit)
    debug('done waiting')
    this.counter.inc(2)
    const resp = await this.client.api(...args)
    debug('got resp')
    return resp
  }

  async api(...args) {
    let nTries = 0
    while (nTries < this.maxTries) {
      nTries += 1
      try {
        const resp = await this.overloadProtectedApiCall(...args)
        return resp
      }
      catch (err) {
        const statusCode = typeof err === 'object' ? err.statusCode : null
        if (statusCode === 520) {
          const msg = `kraken '${args[0]}' failed with ${err.statusCode}`
          info(msg)
        }
        else {
          // const msg = `kraken api call ${JSON.stringify(args)} failed with error: ${err}`
          const e = new Error(`Rethrowing the "${err.message}" error`)
          e.original = err
          e.stack = e.stack.split('\n').slice(0,2).join('\n') + '\n' + err.stack
          throw e
        }
      }
    }
    const msg = `kraken api call ${JSON.stringify(args)} failed after ${nTries} tries`
    throw new Error(msg)
  }
}

module.exports = KrakenSafeWrapper