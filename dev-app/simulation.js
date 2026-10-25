/** Habilitations returned by the simulated api for each simulated user (undefined: api error). */
export const profiles = {
  reader: [{ action: 'lire', subject: 'document' }],
  administrator: [
    { action: 'lire', subject: 'document' },
    { action: 'gerer', subject: 'administration' }
  ],
  'no habilitation': [],
  'api error': undefined
};

/**
 * Simulates the openid connection of aurelia-plugin-oidc.
 */
export class SimulatedConnection {
  isUserLoggedIn = false;
  inProgress = false;
  userName;
  _observers = [];

  observeUser(callback) {
    this._observers.push(callback);
    callback();
    return Promise.resolve();
  }

  login(userName) {
    this.isUserLoggedIn = true;
    this.userName = userName;
    for (const callback of this._observers) callback({ profile: { name: userName } });
  }

  logout() {
    this.isUserLoggedIn = false;
    this.userName = undefined;
    for (const callback of this._observers) callback();
  }
}

/**
 * Simulates an aurelia-fetch-client rejecting the error responses.
 */
export class SimulatedHttpClient {
  constructor(connection) {
    this._connection = connection;
  }

  async fetch() {
    await new Promise(resolve => setTimeout(resolve, 800));
    const habilitations = profiles[this._connection.userName];
    if (!habilitations) throw new Response(undefined, { status: 500 });
    if (habilitations.length === 0) throw new Response(undefined, { status: 403 });
    return new Response(JSON.stringify(habilitations), { status: 200 });
  }
}
