import { ArtifactsServer } from './artifactsServer'
import { FileSystemServer } from './filesystem'
import { BochaSearchServer } from './bochaSearchServer'

export function getInMemoryServer(
  serverName: string,
  args: string[],
  env?: Record<string, string>
) {
  switch (serverName) {
    case 'buildInFileSystem':
      return new FileSystemServer(args)
    case 'Artifacts':
      return new ArtifactsServer()
    case 'bochaSearch':
      return new BochaSearchServer(env)
    default:
      throw new Error(`Unknown in-memory server: ${serverName}`)
  }
}
