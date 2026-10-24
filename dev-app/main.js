import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import environment from './environment';
import { SimulatedConnection, SimulatedHttpClient } from './simulation';

export function configure(aurelia) {
  // the dev app simulates the openid connection and the habilitations api
  const connection = new SimulatedConnection();
  aurelia.container.registerInstance(Connection, connection);

  aurelia.use
    .standardConfiguration()
    // load the plugin ../src
    // The "resources" is mapped to "../src" in aurelia.json "paths"
    .feature('resources', () => ({
      getHttpClient: () => new SimulatedHttpClient(connection),
      homeRoute: 'home'
    }));

  aurelia.use.developmentLogging(environment.debug ? 'debug' : 'warn');

  if (environment.testing) {
    aurelia.use.plugin('aurelia-testing');
  }

  aurelia.start().then(() => aurelia.setRoot());
}
