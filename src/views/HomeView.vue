<template>
  <div class="flex flex-col items-center min-h-screen bg-gray-200">
    <div class="flex flex-col items-center justify-center gap-2 grow p-5">
      <img src="../assets/logo.png" class="rounded-full h-36 w-36" />
      <span class="font-bold text-2xl">DocuNext</span>
      <span class="font-light">Your AI-powered document analysis tool</span>
      <div class="flex flex-row mt-4 gap-2">
        <button
          class="flex flex-row items-center gap-2 bg-gray-300 hover:bg-gray-400 shadow-md px-3 py-2 text-sm font-bold cursor-pointer"
          @click="openNewSessionWindow">
          <span>Start New Session</span>
        </button>
        <button
          class="flex flex-row items-center gap-2 bg-gray-300 hover:bg-gray-400 shadow-md px-3 py-2 text-sm font-bold cursor-pointer"
          @click="openExistingSessionWindow">
          <span>Open Existing Session</span>
        </button>
      </div>
    </div>
    <span class="font-light p-4 text-sm">DocuNext Application</span>
  </div>
</template>

<script setup>
const openNewSessionWindow = () => {
  console.log("Starting new session...")
  window.electronAPI.openNewWindow('/new-session', 600, 800);
};
const openExistingSessionWindow = () => {
  console.log("Opening existing session...")
  window.electronAPI.openNewWindow('/existing-session', 600, 800);
};
</script>