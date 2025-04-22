import { ArtifactsServer } from './artifactsServer'
import { FileSystemServer } from './filesystem'
import { BochaSearchServer } from './bochaSearchServer'
import { BraveSearchServer } from './braveSearchServer'
import { ImageServer } from './imageServer'
import { PowerpackServer } from './powerpackServer'
import { DifyKnowledgeServer } from './difyKnowledgeServer'

export function getInMemoryServer(
  serverName: string,
  args: string[],
  env?: Record<string, string> | string
) {
  switch (serverName) {
    case 'buildInFileSystem':
      return new FileSystemServer(args)
    case 'Artifacts':
      return new ArtifactsServer()
    case 'bochaSearch':
      return new BochaSearchServer(typeof env === 'object' ? env : undefined)
    case 'braveSearch':
      return new BraveSearchServer(typeof env === 'object' ? env : undefined)
    case 'imageServer':
      return new ImageServer(args[0], args[1])
    case 'powerpack':
      return new PowerpackServer()
    case 'difyKnowledge':
      return new DifyKnowledgeServer(typeof env === 'string' ? env : undefined)
    default:
      throw new Error(`Unknown in-memory server: ${serverName}`)
  }
}
