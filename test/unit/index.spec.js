import { Container } from 'aurelia-dependency-injection';
import { configure, AuthorizationConfiguration } from '../../src/index';

describe('index', () => {
  test('configure() registers the resources globally and applies the options', () => {
    const container = new Container();
    const mockAurelia = { container, globalResources: jest.fn(() => {}) };
    const getHttpClient = () => undefined;
    configure(mockAurelia, () => ({ getHttpClient, homeRoute: 'home', messages: { error: 'Erreur' } }));
    expect(mockAurelia.globalResources).toHaveBeenCalled();
    const configuration = container.get(AuthorizationConfiguration);
    expect(configuration.getHttpClient).toBe(getHttpClient);
    expect(configuration.habilitationsUrl).toBe('/api/1.0/utilisateurs/me/habilitations');
    expect(configuration.timeout).toBe(10_000);
    expect(configuration.homeRoute).toBe('home');
    expect(configuration.messages.error).toBe('Erreur');
    expect(configuration.messages.ongoing).toBe('Vérification de vos droits...');
  });

  test('configure() throws when the http client provider is not provided', () => {
    const mockAurelia = { container: new Container(), globalResources: jest.fn(() => {}) };
    expect(() => configure(mockAurelia)).toThrow(/getHttpClient/);
    expect(() => configure(mockAurelia, {})).toThrow(/getHttpClient/);
    expect(() => configure(mockAurelia, () => ({}))).toThrow(/getHttpClient/);
    expect(mockAurelia.globalResources).not.toHaveBeenCalled();
  });
});
