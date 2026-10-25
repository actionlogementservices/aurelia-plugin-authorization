[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm package](https://img.shields.io/npm/v/%40actionlogementservices%2Faurelia-plugin-authorization)](https://www.npmjs.com/package/@actionlogementservices/aurelia-plugin-authorization)

# `@actionlogementservices/aurelia-plugin-authorization`

An Aurelia plugin that provides **user authorization** for **aurelia v1** applications, based on [casl](https://casl.js.org) habilitations retrieved from an api.

## Description

When the user connects (with [aurelia-plugin-oidc](https://github.com/actionlogementservices/aurelia-plugin-oidc)), the plugin:

- fetches the habilitations of the user (`{ action, subject }` items) from an api,
- loads them in the casl `PureAbility` of the application,
- reconfigures the routers with the routes authorized by the habilitations, and navigates again to the requested route,
- blocks the navigation to the unauthorized routes with a router authorize step,
- displays the status of the authorization process (loading, error, unauthorized).

It provides:

| Export / resource                 | Description |
| --------------------------------- | ----------- |
| `Authorizer`                      | the authorization system (singleton): status, habilitations, `can()`, router synchronization, events |
| `AuthorizeStep`                   | the router authorize step |
| `HabilitationService`             | the habilitations retrieval service |
| `Habilitation`                    | the habilitation model `{ action, subject }` |
| `AuthorizationConfiguration`      | the plugin configuration |
| `authorizationEvent`              | the names of the published events (`habilitationsChanged`, `userAuthorized`) |
| `<authorization-status>` element  | displays the authorization process status in a bootstrap alert |
| `able` value converter            | `'lire' \| able: 'document'` is true when the user can perform the action on the subject |

## Installation

1. **Install** the plugin:

   ```node
   npm install @actionlogementservices/aurelia-plugin-authorization
   ```

   `@casl/ability` and `@actionlogementservices/aurelia-plugin-oidc` are peer dependencies, already installed by the applications.

1. **Register** the plugin in aurelia with a callback returning the plugin options, after `aurelia-configuration` and `aurelia-plugin-oidc`:

   ```javascript
   // in your main.js
   import { HttpClientConfigurator } from 'core/http-client-configurator';

   export function configure(aurelia) {
     aurelia.use
       .standardConfiguration()
       .plugin(PLATFORM.moduleName('aurelia-configuration'))
       .plugin(PLATFORM.moduleName('@actionlogementservices/aurelia-plugin-oidc'), () => configureOpenid(aurelia))
       .plugin(PLATFORM.moduleName('@actionlogementservices/aurelia-plugin-authorization'), () => ({
         // the http client of the application, with its oauth2 and error interceptors
         getHttpClient: () => aurelia.container.get(HttpClientConfigurator).initHttpClient('api.ged'),
         habilitationsUrl: '/ged/3.0/utilisateurs/me/habilitations'
       }));
   ```

   | Option                  | Description |
   | ----------------------- | ----------- |
   | `getHttpClient`         | **mandatory** function returning the http client (an aurelia-fetch-client `HttpClient`) used to fetch the habilitations. It is called once, when the habilitations are fetched for the first time. The plugin throws when it is not provided. |
   | `habilitationsUrl`      | url of the api route returning the habilitations of the connected user, relative to the http client base url (default `/api/1.0/utilisateurs/me/habilitations`). |
   | `timeout`               | timeout of the habilitations request in milliseconds (default `10000`). |
   | `homeRoute`             | name of the route where the unauthorized navigations are redirected (default `accueil`). This route must not require habilitations. |
   | `messages`              | messages displayed by `<authorization-status>` for the `ongoing`, `error`, `unauthorized` and `authorized` statuses (html allowed). Only the specified messages replace the default (french) ones. |
   | `onHabilitationsLoaded` | async function called with the habilitations once they are loaded, to load additional user data before the user is authorized. When it fails, the status is `error`. See [Extensibility](#extensibility). |

## Usage

### Application router

In `app.js`, add the authorize step and synchronize the application router with the authorizer:

```javascript
import { inject } from 'aurelia-framework';
import { Router } from 'aurelia-router';
import { Authorizer, AuthorizeStep } from '@actionlogementservices/aurelia-plugin-authorization';
import { routes } from './routes';

@inject(Router, Authorizer)
export class App {
  constructor(router, authorizer) {
    this.router = router;
    this.authorizer = authorizer;
    // reconfigures the router with the authorized routes each time the habilitations change
    this._subscription = authorizer.synchroniseRouter(router, routes);
  }

  detached() {
    this._subscription.dispose();
  }

  configureRouter(configuration) {
    configuration.addAuthorizeStep(AuthorizeStep);
    configuration.map(routes);
    configuration.fallbackRoute('accueil');
  }
}
```

The authorize step redirects to the `homeRoute` when the user is not connected or not authorized to navigate to the route.
The navigation is not blocked while the habilitations are loading: the routers navigate again once they are loaded.

### Protected routes

A route requires habilitations with its `settings`:

```javascript
{
  route: 'administration',
  name: 'administration',
  moduleId: PLATFORM.moduleName('views/administration/administration'),
  nav: true,
  title: 'Administration',
  settings: {
    requiredHabilitations: [
      { action: 'affecter', subject: 'perimetre' },
      { action: 'gerer', subject: 'administration' }
    ],
    // optional: '&&' (default) when all the habilitations are required, '||' when one is enough
    operator: '||'
  }
}
```

A route without `requiredHabilitations` is always authorized.

### Child routers

A child router maps its authorized routes and is synchronized after the application router:

```javascript
@inject(Authorizer, TaskQueue)
export class Demandes {
  constructor(authorizer, taskQueue) {
    this._authorizer = authorizer;
    this._taskQueue = taskQueue;
  }

  detached() {
    this._subscription?.dispose();
  }

  configureRouter(configuration, router) {
    this._taskQueue.queueTask(() => {
      this._subscription = this._authorizer.synchroniseRouter(router, routes);
    });
    configuration.map(this._authorizer.getAuthorizedRoutes(routes));
  }
}
```

### Authorization status

In `app.html`, the `authorization-status` custom element displays the status of the authorization process in a bootstrap alert
(nothing is displayed when the user is authorized):

```html
<authorization-status></authorization-status>
```

### Habilitations in the views and view-models

Use the `able` value converter in the views. The bindings are refreshed when the habilitations change:

```html
<button if.bind="'deposer' | able: 'document'">Déposer</button>
```

Use the `Authorizer` in the view-models:

```javascript
// is the action allowed now?
this.canDeposer = authorizer.can('deposer', 'document');

// once the user is authorized (the callback receives the casl ability)
this._subscription = authorizer.onUserAuthorized(ability => (this.canDeposer = ability.can('deposer', 'document')));

// each time the habilitations change (connection, disconnection, error)
this._subscription = authorizer.onHabilitationsChanged(ability => this.refresh());
```

The casl `PureAbility` can also be injected directly: it is the instance updated by the plugin.

| `Authorizer` member              | Description |
| -------------------------------- | ----------- |
| `status`                         | `'ongoing'`, `'authorized'`, `'unauthorized'` or `'error'` (undefined before the first synchronization) |
| `message`, `alertType`           | message and bootstrap alert type of the status |
| `habilitations`                  | habilitations of the connected user (empty when disconnected or in error) |
| `habilitationsBySubject`         | habilitations grouped by subject: `[{ subject, actions: string[] }]` |
| `can(action, subject)`           | can the user perform the action on the subject? |
| `isRouteAuthorized(route)`       | is the route authorized by the habilitations? |
| `getAuthorizedRoutes(routes)`    | authorized routes (all the routes while the habilitations are loading) |
| `synchroniseRouter(router, routes)` | reconfigures the router each time the habilitations change, returns the subscription |
| `onUserAuthorized(callback)`     | subscribes to the `userAuthorized` event, returns the subscription |
| `onHabilitationsChanged(callback)` | subscribes to the `habilitationsChanged` event, returns the subscription |

### User profile

The user profile view displays the habilitations of the user with the `Authorizer`:

```html
<li class="list-group-item" repeat.for="group of authorizer.habilitationsBySubject">
  <div class="fw-bold">Ressource <small>${group.subject}</small></div>
  <span class="badge bg-secondary" repeat.for="action of group.actions">${action}</span>
</li>
```

### Error interceptor

When the connected user has no habilitation, the habilitations api route answers with a `403` status.
This is an expected answer, not an error: the plugin sets the `unauthorized` status and `<authorization-status>` displays the `unauthorized` message.

However, the request goes through the http client of the application, so its error interceptor sees this `403` response first.
The error interceptor must therefore **not display its error popup** for the `403` response of the habilitations route:

```javascript
// core/error-interceptor.js
export class ErrorInterceptor {
  async responseError(error) {
    // the user has no habilitation: the plugin displays the unauthorized message
    const noHabilitation = error.status === 403 && error.url?.endsWith('/me/habilitations');
    if (!noHabilitation) this.handleApiError(error); // displays the error popup
    throw error;
  }
}
```

The interceptor may either rethrow the response (as above) or return it: the plugin treats both cases as "no habilitation".

## Extensibility

### Additional user data

Use the `onHabilitationsLoaded` option to enrich the user profile with custom data (perimeters, service...) once the habilitations are loaded.
The user is authorized only after this function completes: when it fails, the status is `error`.

The application keeps its own model (here `Profil`) and service (here `ProfilService`).
The model is a singleton of the aurelia container, populated by the option:

```javascript
// main.js
import { Profil } from 'models/profil';
import { ProfilService } from 'services/profil-service';

aurelia.use.plugin(PLATFORM.moduleName('@actionlogementservices/aurelia-plugin-authorization'), () => ({
  getHttpClient: () => aurelia.container.get(HttpClientConfigurator).initHttpClient('api.ged'),
  habilitationsUrl: '/ged/3.0/utilisateurs/me/habilitations',
  // loads the perimeters of the user once the habilitations are loaded
  onHabilitationsLoaded: async habilitations => {
    const perimetres = await aurelia.container.get(ProfilService).getPerimetres();
    aurelia.container.get(Profil).populate({ perimetres });
  }
}));
```

```javascript
// models/profil.js
export class Profil {
  /** @type {{ nomPerimetre: string, codeClient: string }[]} */ perimetres = [];

  populate({ perimetres }) {
    this.perimetres = perimetres ?? [];
  }
}
```

The user profile view injects the same `Profil` instance to display the custom data next to the habilitations:

```javascript
// views/profil-utilisateur/profil-utilisateur.js
import { inject } from 'aurelia-framework';
import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import { Authorizer } from '@actionlogementservices/aurelia-plugin-authorization';
import { Profil } from 'models/profil';

@inject(Connection, Authorizer, Profil)
export class ProfilUtilisateur {
  constructor(connection, authorizer, profil) {
    this.connection = connection;
    this.authorizer = authorizer;
    this.profil = profil;
  }
}
```

```html
<!-- views/profil-utilisateur/profil-utilisateur.html -->
<template>
  <h3>Périmètres</h3>
  <ul class="list-group">
    <li class="list-group-item" repeat.for="perimetre of profil.perimetres">
      <div class="fw-bold">${perimetre.nomPerimetre}</div>
      <span class="badge bg-secondary">${perimetre.codeClient}</span>
    </li>
  </ul>

  <h3>Habilitations</h3>
  <ul class="list-group">
    <li class="list-group-item" repeat.for="group of authorizer.habilitationsBySubject">
      <div class="fw-bold">Ressource <small>${group.subject}</small></div>
      <span class="badge bg-secondary" repeat.for="action of group.actions">${action}</span>
    </li>
  </ul>
</template>
```

### Habilitations retrieval

To retrieve the habilitations differently, register a subclass of `HabilitationService` before the application starts:

```javascript
import { HabilitationService } from '@actionlogementservices/aurelia-plugin-authorization';

class MyHabilitationService extends HabilitationService {
  async getHabilitations() {
    // must return { action, subject }[]
  }
}

aurelia.container.registerSingleton(HabilitationService, MyHabilitationService);
```

## Migration of an application

The plugin is built from the `Als.Service.Ged.Web` implementation (the most recent one).

1. Install the plugin and register it in `main.js` (see [Installation](#installation)). Remove the `@casl/aurelia` plugin if registered: the `able` value converter is provided.
1. Delete the application files:
   - `src/views/app/authorizer/authorizer.{js,html}`,
   - `src/core/authorize-step.js`,
   - `src/resources/value-converters/able.js` (and its registration in `resources/index.js`),
   - `src/models/habilitation.js` and `src/models/permission.js`,
   - `getHabilitations()` in `src/services/habilitation-service.js` (keep the service if it provides other calls).
1. Import `Authorizer`, `AuthorizeStep` and `authorizationEvent` from the plugin instead of the deleted files.
1. Replace `<compose view-model.bind="authorizer"></compose>` with `<authorization-status></authorization-status>` in `app.html`.
1. Move the supplemental calls of the authorizer (`getProfil()` for GED, `getEquipesAls()` for Octroi, `getServiceByIdUtilisateur()` for EER) to the `onHabilitationsLoaded` option (see [Additional user data](#additional-user-data)).
1. In the user profile view, use `authorizer.habilitationsBySubject` (`group.subject` and the `group.actions` strings) instead of the `Object.groupBy` getter.
1. Applications with routes using `settings.requiredPermissions: [{ action, resource }]` and `settings.permissionOperator` (`Als.Del.Web`) must use
   `settings.requiredHabilitations: [{ action, subject }]` and `settings.operator`. Note that the default operator is `'&&'`.
1. Rename `authorizer.typeAlerte` to `authorizer.alertType` if used.

Compared with the existing implementations, the plugin also:

- clears `authorizer.habilitations` when the user disconnects or when the loading fails (they used to stay displayed in the profile),
- does not add a trailing `?` to the url when navigating again to a route without query string,
- handles a rejected 403 habilitations response (`unauthorized` instead of `error`).

## Compatibility

This plugin targets aurelia v1 **webpack** applications using `@casl/ability 6`, `aurelia-plugin-oidc 1` and bootstrap 5 for the alert styles.

## Development

The plugin is bootstrapped by [aurelia-cli](https://github.com/aurelia/cli):

- the `src/` folder contains the source code of the plugin,
- the `dev-app/` folder contains the code of the dev app used to test the plugin. It simulates the openid connection and the habilitations api (`dev-app/simulation.js`).

| Command                 | Description |
| ----------------------- | ----------- |
| `npm start`             | runs the dev app on `http://localhost:9000` |
| `npm test`              | lints and runs the unit tests |
| `npm run lint`          | fixes the lint and formatting issues |
| `npm run build`         | builds the plugin in `dist/` |
| `npm run publish:local` | publishes the plugin locally with [yalc](https://github.com/wclr/yalc) to test it in an application |

To test the plugin in a webpack application, add it with yalc then install it as a copy (not a symbolic link),
otherwise aurelia-webpack-plugin cannot resolve the plugin resources (`Can't figure out a normalized module name`):

```node
npx yalc add @actionlogementservices/aurelia-plugin-authorization
npm install --install-links
```

Always use the `PLATFORM.moduleName()` wrapper in the files of `src/` so that the plugin can be consumed by webpack applications.

## Release

The package is published on npm by the `Release` GitHub workflow, with npm trusted publishing (no npm token is stored in GitHub):

1. In your pull request, bump the version with `npm run bump` (updates `package.json` and `package-lock.json` only).
1. When the pull request is merged on `main`, the workflow runs the tests and **stages** the new version on npm.
   Prerelease versions (e.g. `1.1.0-0`) are staged with the `next` dist-tag.
1. The workflow creates a draft GitHub release and an issue assigned to the person who merged, as a reminder to:
   - approve the staged version in the **Staged Packages** tab of the [npm package](https://www.npmjs.com/package/@actionlogementservices/aurelia-plugin-authorization) (2FA required),
   - publish the draft GitHub release, which creates the git tag,
   - close the issue.

If the staged version is rejected, delete the draft release and close the issue.
