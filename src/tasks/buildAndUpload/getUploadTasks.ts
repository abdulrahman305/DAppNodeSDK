import { ListrTask } from "listr/index.js";
import { BuildVariantsMap, ListrContextBuild } from "../../types.js";
import { getGitHeadIfAvailable } from "../../utils/git.js";
import { getPinMetadata } from "../../pinStrategy/index.js";
import { PinKeyvaluesDefault } from "../../releaseUploader/pinata/index.js";
import { IReleaseUploader } from "../../releaseUploader/index.js";
import { composeDeleteBuildProperties } from "../../files/index.js";

export function getUploadTasks({
  variantsMap,
  skipUpload,
  releaseUploader,
  requireGitData,
  composeFileName
}: {
  variantsMap: BuildVariantsMap;
  skipUpload?: boolean;
  releaseUploader: IReleaseUploader;
  requireGitData: boolean;
  composeFileName: string;
}): ListrTask<ListrContextBuild>[] {
  const uploadTasks: ListrTask<ListrContextBuild>[] = [];

  for (const [variant, { manifest, releaseDir }] of Object.entries(
    variantsMap
  )) {
    const { name: dnpName } = manifest;

    uploadTasks.push({
      title: `Upload release for ${dnpName} to ${releaseUploader.networkName}`,
      skip: () => skipUpload,
      task: async (ctx, task) => {
        const gitHead = await getGitHeadIfAvailable({ requireGitData });

        // Remove `build` property AFTER building. Otherwise it may break ISO installations
        // https://github.com/dappnode/DAppNode_Installer/issues/161
        composeDeleteBuildProperties({ dir: releaseDir, composeFileName });

        ctx[dnpName] = ctx[dnpName] || { variant };
        ctx[dnpName].releaseMultiHash = await releaseUploader.addFromFs({
          dirPath: releaseDir,
          metadata: getPinMetadata(manifest, gitHead) as PinKeyvaluesDefault,
          onProgress: percent => (task.output = percentToMessage(percent))
        });
      }
    });
  }

  return uploadTasks;
}

function percentToMessage(percent: number): string {
  return `Uploading... ${(percent * 100).toFixed(2)}%`;
}
