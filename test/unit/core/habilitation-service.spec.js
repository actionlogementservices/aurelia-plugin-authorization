import { HabilitationService } from '../../../src/core/habilitation-service';
import { AuthorizationConfiguration } from '../../../src/core/authorization-configuration';
import { Habilitation } from '../../../src/models/habilitation';

/** Creates the service with a fake http client. */
const createService = (fetch, options = {}) => {
  const client = { fetch: jest.fn(fetch) };
  const configuration = new AuthorizationConfiguration();
  configuration.configure({ getHttpClient: () => client, ...options });
  return { service: new HabilitationService(configuration), client };
};

const jsonResponse = (data, status = 200) => ({ status, json: async () => data });

describe('HabilitationService', () => {
  test('fetches the habilitations from the configured url', async () => {
    const { service, client } = createService(async () =>
      jsonResponse([{ action: 'lire', subject: 'document', extra: 1 }])
    );
    const habilitations = await service.getHabilitations();
    expect(habilitations).toEqual([{ action: 'lire', subject: 'document' }]);
    expect(habilitations[0]).toBeInstanceOf(Habilitation);
    expect(client.fetch).toHaveBeenCalledWith('/api/1.0/utilisateurs/me/habilitations', {
      signal: expect.any(AbortSignal)
    });
  });

  test('uses the configured url and creates the http client once', async () => {
    const getHttpClient = jest.fn(() => ({ fetch: async () => jsonResponse([]) }));
    const configuration = new AuthorizationConfiguration();
    configuration.configure({ getHttpClient, habilitationsUrl: '/ged/3.0/utilisateurs/me/habilitations' });
    const service = new HabilitationService(configuration);
    await service.getHabilitations();
    await service.getHabilitations();
    expect(getHttpClient).toHaveBeenCalledTimes(1);
  });

  test('returns no habilitation on a resolved or rejected 403 response', async () => {
    const { service: resolving } = createService(async () => jsonResponse(undefined, 403));
    expect(await resolving.getHabilitations()).toEqual([]);
    const { service: rejecting } = createService(async () => {
      throw jsonResponse(undefined, 403);
    });
    expect(await rejecting.getHabilitations()).toEqual([]);
  });

  test('rethrows the other errors', async () => {
    const { service } = createService(async () => {
      throw jsonResponse(undefined, 500);
    });
    await expect(service.getHabilitations()).rejects.toMatchObject({ status: 500 });
  });
});
