import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'

// --- Zod Schemas for Tool Arguments ---

const ReadImageBase64ArgsSchema = z.object({
  path: z.string().describe('Path to the image file.')
})

const UploadImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file to upload.')
})

const ReadMultipleImagesBase64ArgsSchema = z.object({
  paths: z.array(z.string()).describe('List of paths to the image files.')
})

const UploadMultipleImagesArgsSchema = z.object({
  paths: z.array(z.string()).describe('List of paths to the image files to upload.')
})

const DescribeImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file to describe.')
})

const OcrImageArgsSchema = z.object({
  path: z.string().describe('Path to the image file for OCR text extraction.')
})

const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// --- Image Server Implementation ---

export class ImageServer {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'image-processing-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.setupRequestHandlers()
  }

  // No specific initialization needed for now, but can be added for upload service config
  // public async initialize(): Promise<void> {
  //   // Initialization logic, e.g., configure upload service client
  // }

  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // --- Placeholder for Image Upload Logic ---
  private async uploadImageToService(filePath: string, fileBuffer: Buffer): Promise<string> {
    // TODO: Implement actual image upload logic here
    // This might involve using a library like 'axios' or a specific SDK
    // for services like Imgur, AWS S3, Cloudinary, etc.
    console.log(`Uploading ${filePath} (size: ${fileBuffer.length} bytes)...`)
    // Replace with actual upload call
    await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate network delay
    const fakeUrl = `https://fake-upload-service.com/uploads/${path.basename(filePath)}_${Date.now()}`
    console.log(`Upload complete: ${fakeUrl}`)
    return fakeUrl
  }

  // --- Placeholder for Multimodal Model Interaction ---
  private async describeImageWithModel(filePath: string, fileBuffer: Buffer): Promise<string> {
    // TODO: Implement actual API call to a multimodal model (e.g., GPT-4o, Gemini)
    console.log(`Requesting description for ${filePath} (size: ${fileBuffer.length} bytes)...`)
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const fakeDescription = `This is a placeholder description for the image at ${path.basename(filePath)}.`
    console.log(`Description received: ${fakeDescription}`)
    return fakeDescription
  }

  private async ocrImageWithModel(filePath: string, fileBuffer: Buffer): Promise<string> {
    // TODO: Implement actual API call to an OCR service or a multimodal model capable of OCR
    console.log(`Requesting OCR for ${filePath} (size: ${fileBuffer.length} bytes)...`)
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    const fakeOcrText = `Placeholder OCR text for ${path.basename(filePath)}:\nLine 1\nLine 2`
    console.log(`OCR text received: ${fakeOcrText}`)
    return fakeOcrText
  }

  // --- Request Handlers ---

  private setupRequestHandlers(): void {
    // List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_image_base64',
            description:
              'Reads an image file from the specified path and returns its base64 encoded content.',
            inputSchema: zodToJsonSchema(ReadImageBase64ArgsSchema) as ToolInput
          },
          {
            name: 'upload_image',
            description:
              'Uploads an image file from the specified path to a hosting service and returns the public URL.',
            inputSchema: zodToJsonSchema(UploadImageArgsSchema) as ToolInput
          },
          {
            name: 'read_multiple_images_base64',
            description:
              'Reads multiple image files from the specified paths and returns their base64 encoded content.',
            inputSchema: zodToJsonSchema(ReadMultipleImagesBase64ArgsSchema) as ToolInput
          },
          {
            name: 'upload_multiple_images',
            description:
              'Uploads multiple image files from the specified paths to a hosting service and returns their public URLs.',
            inputSchema: zodToJsonSchema(UploadMultipleImagesArgsSchema) as ToolInput
          },
          {
            name: 'describe_image',
            description:
              'Uses a multimodal model to generate a description of the image at the specified path.',
            inputSchema: zodToJsonSchema(DescribeImageArgsSchema) as ToolInput
          },
          {
            name: 'ocr_image',
            description:
              'Performs Optical Character Recognition (OCR) on the image at the specified path and returns the extracted text.',
            inputSchema: zodToJsonSchema(OcrImageArgsSchema) as ToolInput
          }
        ]
      }
    })

    // Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'read_image_base64': {
            const parsed = ReadImageBase64ArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary (similar to FileSystemServer)
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const base64Content = fileBuffer.toString('base64')
            // Determine mime type (optional but good practice)
            // const mimeType = lookup(filePath) || 'application/octet-stream';
            // const dataUri = `data:${mimeType};base64,${base64Content}`;
            return {
              content: [{ type: 'text', text: base64Content }] // Or return dataUri
            }
          }

          case 'upload_image': {
            const parsed = UploadImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const imageUrl = await this.uploadImageToService(filePath, fileBuffer)
            return {
              content: [{ type: 'text', text: imageUrl }]
            }
          }

          case 'read_multiple_images_base64': {
            const parsed = ReadMultipleImagesBase64ArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            const results = await Promise.allSettled(
              parsed.data.paths.map(async (filePath: string) => {
                try {
                  // TODO: Implement path validation if necessary
                  const fileBuffer = await fs.readFile(filePath)
                  return {
                    path: filePath,
                    base64: fileBuffer.toString('base64'),
                    status: 'fulfilled'
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  return { path: filePath, error: errorMessage, status: 'rejected' }
                }
              })
            )

            // Format output: [{path: string, base64?: string, error?: string}]
            const formattedResults = results.map((result) => {
              if (result.status === 'fulfilled') {
                return { path: result.value.path, base64: result.value.base64 }
              } else {
                return { path: result.reason.path, error: result.reason.error }
              }
            })

            return {
              content: [{ type: 'text', text: JSON.stringify(formattedResults, null, 2) }]
            }
          }

          case 'upload_multiple_images': {
            const parsed = UploadMultipleImagesArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }

            const results = await Promise.allSettled(
              parsed.data.paths.map(async (filePath: string) => {
                try {
                  // TODO: Implement path validation if necessary
                  const fileBuffer = await fs.readFile(filePath)
                  const url = await this.uploadImageToService(filePath, fileBuffer)
                  return { path: filePath, url: url, status: 'fulfilled' }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  return { path: filePath, error: errorMessage, status: 'rejected' }
                }
              })
            )

            // Format output: [{path: string, url?: string, error?: string}]
            const formattedResults = results.map((result) => {
              if (result.status === 'fulfilled') {
                return { path: result.value.path, url: result.value.url }
              } else {
                // Adjusting access to path and error based on the structure in the catch block
                const reason = result.reason as { path: string; error: string; status: 'rejected' }
                return { path: reason.path, error: reason.error }
              }
            })

            return {
              content: [{ type: 'text', text: JSON.stringify(formattedResults, null, 2) }]
            }
          }

          case 'describe_image': {
            const parsed = DescribeImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const description = await this.describeImageWithModel(filePath, fileBuffer)
            return {
              content: [{ type: 'text', text: description }]
            }
          }

          case 'ocr_image': {
            const parsed = OcrImageArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`Invalid arguments for ${name}: ${parsed.error}`)
            }
            // TODO: Implement path validation if necessary
            const filePath = parsed.data.path
            const fileBuffer = await fs.readFile(filePath)
            const ocrText = await this.ocrImageWithModel(filePath, fileBuffer)
            return {
              content: [{ type: 'text', text: ocrText }]
            }
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        // Consider logging the error server-side
        console.error(`Error processing tool call: ${errorMessage}`)
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true
        }
      }
    })
  }
}

// --- Usage Example (similar to FileSystemServer) ---
// import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/transport/node';
//
// const imageServer = new ImageServer();
// // await imageServer.initialize(); // If initialization is added
//
// // Example using WebSocket transport
// const transport = new WebSocketServerTransport({ port: 8081 }); // Choose a different port
// imageServer.startServer(transport);
// console.log('ImageServer started on port 8081');

// You would need a client to connect to this server and call the tools.
