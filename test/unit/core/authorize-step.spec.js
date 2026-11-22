import { RedirectToRoute } from 'aurelia-router';
import { AuthorizeStep, isPublicNavigation } from '../../../src/core/authorize-step';
import { AuthorizationConfiguration } from '../../../src/core/authorization-configuration';

/** Creates the step with fake dependencies. */
const createStep = ({ isUserLoggedIn = true, status = 'authorized', isRouteAuthorized = true } = {}) => {
  const configuration = new AuthorizationConfiguration();
  configuration.configure({ getHttpClient: () => undefined, homeRoute: 'home' });
  const authorizer = { status, isRouteAuthorized: () => isRouteAuthorized };
  return new AuthorizeStep({ isUserLoggedIn }, authorizer, configuration);
};

/** Creates a fake pipeline processor. */
const createNext = () => {
  const next = jest.fn(() => 'next');
  next.cancel = jest.fn(() => 'cancel');
  return next;
};

const instruction = (name, settings) => ({ config: { name, settings } });

/** Creates a navigation instruction with a child navigation in the default viewport. */
const withChild = (parent, child) => ({
  ...parent,
  viewPortInstructions: { default: { childNavigationInstruction: child } }
});

describe('AuthorizeStep', () => {
  test('lets the authorized navigation through', () => {
    const next = createNext();
    expect(createStep().run(instruction('documents'), next)).toBe('next');
  });

  test('lets the navigation through while the habilitations are loading or to the home route', () => {
    const next = createNext();
    expect(
      createStep({ status: 'ongoing', isRouteAuthorized: false }).run(instruction('documents'), next)
    ).toBe('next');
    expect(createStep({ isUserLoggedIn: false }).run(instruction('home'), next)).toBe('next');
  });

  test('redirects to the home route when the user is not connected or not authorized', () => {
    for (const options of [{ isUserLoggedIn: false }, { isRouteAuthorized: false }]) {
      const next = createNext();
      expect(createStep(options).run(instruction('documents'), next)).toBe('cancel');
      const [redirect] = next.cancel.mock.calls[0];
      expect(redirect).toBeInstanceOf(RedirectToRoute);
      expect(redirect.route).toBe('home');
    }
  });

  test('lets a user who is not connected navigate to a public route', () => {
    const next = createNext();
    expect(createStep({ isUserLoggedIn: false }).run(instruction('faq', { authRequired: false }), next)).toBe(
      'next'
    );
  });

  test('redirects a user who is not connected from a route that is not explicitly public', () => {
    for (const settings of [{}, { authRequired: true }]) {
      const next = createNext();
      expect(createStep({ isUserLoggedIn: false }).run(instruction('documents', settings), next)).toBe(
        'cancel'
      );
    }
  });
});

describe('isPublicNavigation', () => {
  test('is true only for a route explicitly not requiring authentication', () => {
    expect(isPublicNavigation(instruction('faq', { authRequired: false }))).toBe(true);
    expect(isPublicNavigation(instruction('faq', { authRequired: true }))).toBe(false);
    expect(isPublicNavigation(instruction('faq'))).toBe(false);
  });

  test('is false when the route requires habilitations', () => {
    const settings = { authRequired: false, requiredHabilitations: [{ action: 'read', subject: 'faq' }] };
    expect(isPublicNavigation(instruction('faq', settings))).toBe(false);
  });

  test('takes into account the child routes, the deepest setting winning', () => {
    const publicParent = instruction('help', { authRequired: false });
    expect(isPublicNavigation(withChild(publicParent, instruction('faq')))).toBe(true);
    expect(isPublicNavigation(withChild(publicParent, instruction('admin', { authRequired: true })))).toBe(
      false
    );
    expect(
      isPublicNavigation(withChild(instruction('help'), instruction('faq', { authRequired: false })))
    ).toBe(true);
  });
});
