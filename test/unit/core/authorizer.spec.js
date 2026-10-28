import { EventAggregator } from 'aurelia-event-aggregator';
import { PureAbility } from '@casl/ability';
import { StageComponent } from 'aurelia-testing';
import { bootstrap } from 'aurelia-bootstrapper';
import { Authorizer, authorizationEvent } from '../../../src/core/authorizer';
import { AuthorizationConfiguration } from '../../../src/core/authorization-configuration';

const reader = [{ action: 'lire', subject: 'document' }];
const routes = [
  { name: 'accueil', route: '' },
  { name: 'documents', route: 'documents', settings: { requiredHabilitations: reader } },
  {
    name: 'administration',
    route: 'administration',
    settings: {
      requiredHabilitations: [
        { action: 'lire', subject: 'document' },
        { action: 'gerer', subject: 'administration' }
      ]
    }
  },
  {
    name: 'recherche',
    route: 'recherche',
    settings: {
      requiredHabilitations: [
        { action: 'lire', subject: 'document' },
        { action: 'gerer', subject: 'administration' }
      ],
      operator: '||'
    }
  }
];

/** Creates an authorizer with fake dependencies, the task queue running the tasks synchronously. */
const createAuthorizer = (options = {}) => {
  const connection = { isUserLoggedIn: true, inProgress: false, observeUser: jest.fn() };
  const habilitationService = { getHabilitations: jest.fn(async () => reader) };
  const eventAggregator = new EventAggregator();
  const taskQueue = { queueTask: callback => callback(), queueMicroTask: callback => callback() };
  const configuration = new AuthorizationConfiguration();
  configuration.configure({ getHttpClient: () => undefined, ...options });
  const authorizer = new Authorizer(
    connection,
    habilitationService,
    new PureAbility(),
    eventAggregator,
    taskQueue,
    configuration
  );
  const notifyUser = connection.observeUser.mock.calls[0][0];
  return { authorizer, connection, habilitationService, eventAggregator, notifyUser };
};

/** Creates a fake router whose current instruction targets the specified route. */
const createRouter = (routeName, fragment, queryString = '') => ({
  currentInstruction: { config: { name: routeName }, fragment, queryString },
  routes: [],
  navigation: [],
  // like the aurelia router, adds the navigation model then sorts the navigation
  addRoute: jest.fn(function (route) {
    this.routes.push(route);
    this.navigation.push({ config: route, order: this.routes.length });
    this.navigation.sort((a, b) => a.order - b.order);
  }),
  refreshNavigation: jest.fn(),
  navigate: jest.fn()
});

describe('Authorizer', () => {
  test('loads the habilitations when the user connects', async () => {
    const { authorizer, eventAggregator, notifyUser } = createAuthorizer();
    const authorized = jest.fn();
    const changed = jest.fn();
    eventAggregator.subscribe(authorizationEvent.authorized, authorized);
    eventAggregator.subscribe(authorizationEvent.changed, changed);
    const loading = notifyUser({ profile: {} });
    expect(authorizer.status).toBe('ongoing');
    expect(authorizer.message).toBe('Vérification de vos droits...');
    await loading;
    expect(authorizer.status).toBe('authorized');
    expect(authorizer.message).toBeUndefined();
    expect(authorizer.habilitations).toEqual(reader);
    expect(authorizer.can('lire', 'document')).toBe(true);
    expect(authorizer.can('gerer', 'administration')).toBe(false);
    expect(authorized).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  test('sets the unauthorized status without habilitation and clears them on disconnection', async () => {
    const { authorizer, habilitationService, notifyUser } = createAuthorizer();
    await notifyUser({ profile: {} });
    await notifyUser(undefined);
    expect(authorizer.status).toBe('unauthorized');
    expect(authorizer.habilitations).toEqual([]);
    expect(authorizer.can('lire', 'document')).toBe(false);
    habilitationService.getHabilitations.mockResolvedValue([]);
    await notifyUser({ profile: {} });
    expect(authorizer.status).toBe('unauthorized');
    expect(authorizer.alertType).toBe('warning');
  });

  test('sets the error status when the habilitations or the additional data cannot be loaded', async () => {
    const onHabilitationsLoaded = jest.fn(async () => {
      throw new Error('profil');
    });
    const { authorizer, habilitationService, notifyUser } = createAuthorizer({ onHabilitationsLoaded });
    await notifyUser({ profile: {} });
    expect(onHabilitationsLoaded).toHaveBeenCalledWith(reader);
    expect(authorizer.status).toBe('error');
    expect(authorizer.can('lire', 'document')).toBe(false);
    onHabilitationsLoaded.mockResolvedValue();
    habilitationService.getHabilitations.mockRejectedValue(new Error('network'));
    await notifyUser({ profile: {} });
    expect(authorizer.status).toBe('error');
    expect(authorizer.alertType).toBe('danger');
  });

  test('ignores the user reloading during the silent login', async () => {
    const { authorizer, connection, habilitationService, notifyUser } = createAuthorizer();
    connection.inProgress = true;
    await notifyUser({ profile: {} });
    expect(authorizer.status).toBeUndefined();
    expect(habilitationService.getHabilitations).not.toHaveBeenCalled();
  });

  test('applies the configured messages', async () => {
    const { authorizer, notifyUser } = createAuthorizer({ messages: { unauthorized: 'Accès refusé' } });
    await notifyUser(undefined);
    expect(authorizer.message).toBe('Accès refusé');
  });

  test('groups the habilitations by subject', async () => {
    const { authorizer, habilitationService, notifyUser } = createAuthorizer();
    habilitationService.getHabilitations.mockResolvedValue([
      { action: 'lire', subject: 'document' },
      { action: 'gerer', subject: 'administration' },
      { action: 'modifier', subject: 'document' }
    ]);
    await notifyUser({ profile: {} });
    expect(authorizer.habilitationsBySubject).toEqual([
      { subject: 'document', actions: ['lire', 'modifier'] },
      { subject: 'administration', actions: ['gerer'] }
    ]);
  });

  test('authorizes the routes with the and/or operators', async () => {
    const { authorizer, notifyUser } = createAuthorizer();
    await notifyUser({ profile: {} });
    expect(routes.map(route => authorizer.isRouteAuthorized(route))).toEqual([true, true, false, true]);
    expect(authorizer.getAuthorizedRoutes(routes).map(route => route.name)).toEqual([
      'accueil',
      'documents',
      'recherche'
    ]);
  });

  test('returns all the routes while the habilitations are loading', () => {
    const { authorizer, notifyUser } = createAuthorizer();
    notifyUser({ profile: {} });
    expect(authorizer.getAuthorizedRoutes(routes)).toBe(routes);
  });

  test('reconfigures the router and navigates again to the authorized current route', async () => {
    const { authorizer, notifyUser } = createAuthorizer();
    const router = createRouter('documents', 'documents', 'tri=date');
    const subscription = authorizer.synchroniseRouter(router, routes);
    await notifyUser({ profile: {} });
    expect(router.routes.map(route => route.name)).toEqual(['accueil', 'documents', 'recherche']);
    expect(router.refreshNavigation).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('documents?tri=date', { replace: true });
    subscription.dispose();
  });

  test('keeps the navigation array of the router, which may be referenced by a menu', async () => {
    const { authorizer, notifyUser } = createAuthorizer();
    const router = createRouter('documents', 'documents');
    router.navigation.push({ config: { name: 'stale' } });
    const menuItems = router.navigation;
    authorizer.synchroniseRouter(router, routes);
    await notifyUser({ profile: {} });
    expect(router.navigation).toBe(menuItems);
    expect(menuItems.map(navModel => navModel.config.name)).toEqual(['accueil', 'documents', 'recherche']);
  });

  test('refreshes the menus bound to the navigation of the router, without duplicates', async () => {
    const { authorizer, notifyUser } = createAuthorizer();
    const router = createRouter('documents', 'documents');
    for (const route of routes) router.addRoute(route);
    const component = StageComponent.withResources([])
      .inView('<div><span repeat.for="navModel of router.navigation">${navModel.config.name}</span></div>')
      .boundTo({ router });
    await component.create(bootstrap);
    authorizer.synchroniseRouter(router, routes);
    await notifyUser({ profile: {} });
    // the repeat is refreshed asynchronously
    await new Promise(resolve => setTimeout(resolve, 10));
    const rendered = [...component.element.querySelectorAll('span')].map(span => span.textContent);
    expect(rendered).toEqual(['accueil', 'documents', 'recherche']);
    component.dispose();
  });

  test('navigates to the default route when the current route is not authorized anymore', async () => {
    const { authorizer, notifyUser } = createAuthorizer();
    const router = createRouter('administration', 'administration');
    authorizer.synchroniseRouter(router, routes);
    await notifyUser({ profile: {} });
    expect(router.navigate).toHaveBeenCalledWith('', { replace: true });
  });

  test('does not reconfigure the router when it is not ready or the user is disconnected', async () => {
    const { authorizer, connection, notifyUser } = createAuthorizer();
    const router = { ...createRouter('documents', 'documents'), currentInstruction: undefined };
    authorizer.synchroniseRouter(router, routes);
    await notifyUser({ profile: {} });
    expect(router.addRoute).not.toHaveBeenCalled();
    const readyRouter = createRouter('documents', 'documents');
    authorizer.synchroniseRouter(readyRouter, routes);
    connection.isUserLoggedIn = false;
    await notifyUser(undefined);
    expect(readyRouter.addRoute).not.toHaveBeenCalled();
  });
});
