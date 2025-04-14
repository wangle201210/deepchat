import { ArtifactsServer } from './artifactsServer'
import { FileSystemServer } from './filesystem'
import { BochaSearchServer } from './bochaSearchServer'
import { BraveSearchServer } from './braveSearchServer'
import { ImageServer } from './imageServer'
import { PowerpackServer } from './powerpackServer'

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
    case 'braveSearch':
      return new BraveSearchServer(env)
    case 'imageServer':
      return new ImageServer(args[0], args[1])
    case 'powerpack':
      return new PowerpackServer()
    default:
      throw new Error(`Unknown in-memory server: ${serverName}`)
  }
}
