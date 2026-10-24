import { RedirectToRoute } from 'aurelia-router';
import { AuthorizeStep } from '../../../src/core/authorize-step';
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

const instruction = name => ({ config: { name } });

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
});
