import { ArtifactsServer } from './artifactsServer'
import { FileSystemServer } from './filesystem'
import { ImageServer } from './imageServer'

export function getInMemoryServer(serverName: string, args: string[]) {
  switch (serverName) {
    case 'buildInFileSystem':
      return new FileSystemServer(args)
    case 'Artifacts':
      return new ArtifactsServer()
    case 'imageServer':
      return new ImageServer()
    default:
      throw new Error(`Unknown in-memory server: ${serverName}`)
  }
}
