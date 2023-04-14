import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { ensureDappnodeEnvironment } from "./ensureDappnodeEnvironment.js";
import { readCompose, readManifest } from "../../../files/index.js";
import { buildHandler } from "../../build.js";
import { executePackageInstallAndUpdateTest } from "./executeTests.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";

const localIpfsApiUrl = `http://172.33.1.5:5001`;
const localDappmanagerTestApiUrl = `http://172.33.1.7:7000`;
interface CliCommandOptions extends CliGlobalOptions {
  healthCheckUrl?: string;
  errorLogsTimeout: number;
  environmentByService?: string;
}

export const endToEndTest: CommandModule<
  CliGlobalOptions,
  CliCommandOptions
> = {
  command: "test-end-to-end",
  describe: "Run end to end tests (Install from scratch and update)",
  builder: {
    healthCheckUrl: {
      type: "string",
      describe:
        "Optional health check URL, if the HTTP code is not 200, the test will fail"
    },
    errorLogsTimeout: {
      describe:
        "Timeout in seconds to wait for error logs to appear. If error logs appear after the timeout, the test will fail",
      type: "number",
      default: 30
    },
    environmentByService: {
      describe:
        "Environments by service to install the package with. JSON format",
      nargs: 1,
      type: "string",
      default: "{}"
    }
  },
  handler: async (args): Promise<void> => await gaTestEndToEndHandler(args)
};

export async function gaTestEndToEndHandler({
  dir,
  healthCheckUrl,
  errorLogsTimeout,
  environmentByService
}: CliCommandOptions): Promise<void> {
  const dappmanagerTestApi = new DappmanagerTestApi(localDappmanagerTestApiUrl);
  const compose = readCompose({ dir });
  const { manifest } = readManifest({ dir });
  const environmentByServiceParsed: Record<
    string,
    string
  > = environmentByService ? JSON.parse(environmentByService) : {};

  try {
    // Build and upload
    const { releaseMultiHash } = await buildHandler({
      dir,
      provider: localIpfsApiUrl,
      upload_to: "ipfs",
      verbose: false
    });

    // Ensure test-integration environment is clean
    await ensureDappnodeEnvironment({
      dappmanagerTestApi,
      dnpName: manifest.name
    });

    await executePackageInstallAndUpdateTest({
      dappmanagerTestApi,
      releaseMultiHash,
      manifest,
      compose,
      healthCheckUrl,
      errorLogsTimeout,
      environmentByService: environmentByServiceParsed
    });
  } catch (e) {
    throw Error(`Error on test-integration: ${e}`);
  } finally {
    // Ensure test-integration environment is cleaned
    await ensureDappnodeEnvironment({
      dappmanagerTestApi,
      dnpName: manifest.name
    });
  }
}
