import { inject } from 'aurelia-framework';
import { Router } from 'aurelia-router';
import { Connection } from '@actionlogementservices/aurelia-plugin-oidc';
import { Authorizer, AuthorizeStep } from 'resources';
import { profiles } from './simulation';

const routes = [
  { route: ['', 'home'], name: 'home', moduleId: 'pages/page', nav: true, title: 'Home' },
  {
    route: 'documents',
    name: 'documents',
    moduleId: 'pages/page',
    nav: true,
    title: 'Documents',
    settings: { requiredHabilitations: [{ action: 'lire', subject: 'document' }] }
  },
  {
    route: 'administration',
    name: 'administration',
    moduleId: 'pages/page',
    nav: true,
    title: 'Administration',
    settings: { requiredHabilitations: [{ action: 'gerer', subject: 'administration' }] }
  },
  {
    route: 'search',
    name: 'search',
    moduleId: 'pages/page',
    nav: true,
    title: 'Search',
    settings: {
      requiredHabilitations: [
        { action: 'lire', subject: 'document' },
        { action: 'gerer', subject: 'administration' }
      ],
      operator: '||'
    }
  }
];

@inject(Router, Connection, Authorizer)
export class App {
  users = Object.keys(profiles);

  constructor(router, connection, authorizer) {
    this.router = router;
    this.connection = connection;
    this.authorizer = authorizer;
    this._subscription = authorizer.synchroniseRouter(router, routes);
  }

  detached() {
    this._subscription.dispose();
  }

  configureRouter(configuration) {
    configuration.title = 'aurelia-plugin-authorization';
    configuration.addAuthorizeStep(AuthorizeStep);
    configuration.map(routes);
    configuration.fallbackRoute('home');
  }
}
