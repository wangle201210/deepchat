// fix-sharp.js
// 该脚本用于修复跨平台构建时 sharp 模块的兼容性问题
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/**
 * 该函数在应用打包前执行，确保 sharp 模块能够在跨平台环境中正确加载
 */
function fixSharpForCrossPlatform() {
  console.log('开始修复 sharp 模块跨平台兼容性问题...');
  
  try {
    // 获取当前平台和目标架构信息
    const currentPlatform = process.platform;
    const targetArch = process.env.npm_config_arch || process.arch;
    
    console.log(`当前平台: ${currentPlatform}, 目标架构: ${targetArch}`);
    
    // 如果是在 macOS 上构建
    if (currentPlatform === 'darwin') {
      console.log('检测到 macOS 平台，准备处理 sharp 依赖...');
      
      // 强制重新安装 sharp，确保二进制文件正确
      console.log('重新安装 sharp 模块...');
      
      // 设置环境变量，确保使用正确的平台和架构
      const env = {
        ...process.env,
        npm_config_build_from_source: 'true',
        npm_config_cpu: targetArch,
        npm_config_os: 'darwin'
      };
      
      // 执行安装命令
      execSync('pnpm install sharp --force', { 
        stdio: 'inherit',
        env 
      });
      
      // 创建目标目录
      const sharpBinDir = path.join(process.cwd(), 'resources', 'sharp-bin', targetArch);
      fs.mkdirSync(sharpBinDir, { recursive: true });
      
      // 复制 sharp 的二进制文件到资源目录
      const sharpVendorDir = path.join(process.cwd(), 'node_modules', 'sharp', 'vendor');
      const sharpBuildDir = path.join(process.cwd(), 'node_modules', 'sharp', 'build', 'Release');
      
      if (fs.existsSync(sharpVendorDir)) {
        console.log(`复制 sharp vendor 文件从 ${sharpVendorDir} 到 ${sharpBinDir}`);
        execSync(`cp -R "${sharpVendorDir}" "${sharpBinDir}"`);
      }
      
      if (fs.existsSync(sharpBuildDir)) {
        console.log(`复制 sharp build 文件从 ${sharpBuildDir} 到 ${sharpBinDir}`);
        execSync(`cp -R "${sharpBuildDir}" "${sharpBinDir}"`);
      }
      
      console.log('Sharp 二进制文件已复制到资源目录');
    }
    
    console.log('Sharp 模块跨平台兼容性修复完成！');
  } catch (error) {
    console.error('修复 sharp 模块时出错:', error);
    process.exit(1);
  }
}

// 执行修复函数
fixSharpForCrossPlatform();
