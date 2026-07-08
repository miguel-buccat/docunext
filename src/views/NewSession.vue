<template>
  <!-- Added 'relative' to make sure the overlay anchors properly to this layout -->
  <div class="flex flex-col items-center min-h-screen bg-gray-200 relative">
    <div class="flex flex-col items-center justify-start gap-2 grow py-5">
      <span class="font-bold text-2xl">Start New Session</span>
      <span class="font-light">Upload your documents to analyze</span>

      <!-- Hidden file input triggered via click -->
      <input type="file" ref="fileInput" multiple class="hidden" @change="handleFileSelect" />

      <!-- Drag & Drop container with event listeners -->
      <div @click="triggerBrowse" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false"
        @drop.prevent="handleFileDrop" :class="[
          'w-96 mx-5 p-8 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors cursor-pointer select-none',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-white/50 hover:bg-white'
        ]">
        <svg class="w-10 h-10 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span class="font-medium text-sm text-gray-700">Drag & Drop files here</span>
        <span class="text-xs text-gray-500 mt-1">or click to browse</span>
      </div>

      <!-- Dynamic File Cards List -->
      <div class="w-96 flex flex-col gap-2">
        <div v-for="(file, index) in files" :key="file.id"
          class="flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg shadow-sm">
          <span class="text-sm font-medium text-gray-700 truncate">{{ file.name }}</span>
          <button @click="removeFile(index)" class="text-gray-400 hover:text-red-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Action button disabled when no files are selected -->
    <button @click="startSession" :disabled="files.length === 0"
      class="w-96 mb-2 py-2.5 px-4 text-white font-medium rounded-lg shadow transition-colors text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      :class="files.length === 0 ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'">
      Start Session
    </button>
    <span class="font-light p-4 text-sm">DocuNext Application</span>

    <!-- Smooth Transition Overlay for the analyzing state -->
    <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0"
      enter-to-class="opacity-100" leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div v-if="isAnalyzing"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50 rounded-xl">
        <!-- Tailwind animated spinner ring -->
        <div class="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin"></div>
        <!-- Pulsing processing indicator label -->
        <span class="text-white font-medium text-sm animate-pulse tracking-wide">Analyzing documents...</span>
      </div>
    </Transition>
  </div>
</template>


<script setup>
import { ref } from 'vue'

const isAnalyzing = ref(false)
const isDragging = ref(false)
const files = ref([])

const triggerBrowse = async () => {
  const selectedPaths = await window.electronAPI.uploadDocs()
  if (selectedPaths) {
    addPathsToList(selectedPaths)
  }
}

// 2. DRAG & DROP: HTML DOM tracks dropped items, then parses paths
const handleFileDrop = (event) => {
  isDragging.value = false
  if (event.dataTransfer?.files) {
    // Inside Electron, the native File object contains the real absolute path
    const droppedPaths = Array.from(event.dataTransfer.files).map(file => file.path || file.name)
    addPathsToList(droppedPaths)
  }
}

// Helper to push extracted string paths into UI view state
const addPathsToList = (pathsArray) => {
  pathsArray.forEach(filePath => {
    // Extract file name from the end of the absolute path string
    const fileName = filePath.split(/[/\\]/).pop()

    // Prevent adding duplicates
    if (!files.value.some(f => f.path === filePath)) {
      files.value.push({
        id: crypto.randomUUID(),
        name: fileName,
        path: filePath // Guaranteed string path
      })
    }
  })
}

const removeFile = (index) => {
  files.value.splice(index, 1)
}

const startSession = () => {
  const filePaths = files.value.map(f => f.path)
  console.log('Sending native paths to Electron Backend:', filePaths)

  isAnalyzing.value = true

  window.electronAPI.createSession(filePaths)
}
</script>
