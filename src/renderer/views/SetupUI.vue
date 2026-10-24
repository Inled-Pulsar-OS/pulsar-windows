<template>
    <div class="relative size-full p-12 overflow-hidden">
        <div class="size-full rounded-3xl bg-[#1A1A1A] shadow-2xl shadow-black/70 gap-6 p-8 grid grid-cols-2 border border-neutral-800">
            <!-- Left Side / Step Indicator -->
            <div class="flex flex-col justify-between h-full border-r border-neutral-800/80 pr-6">
                <div>
                    <div class="flex items-center gap-3 mb-6">
                        <img src="/img/winboat_logo.svg" class="size-8" alt="Pulsar Windows" />
                        <h2 class="text-xl font-bold tracking-tight text-white">Pulsar Windows</h2>
                    </div>

                    <div id="stepStatus" class="flex flex-row gap-3 pt-2">
                        <div
                            v-for="(_, idx) of steps"
                            :key="idx"
                            class="h-2 flex-1 rounded-full transition-all duration-500"
                            :class="{
                                'bg-violet-500': idx <= currentStepIdx,
                                'bg-neutral-800': idx > currentStepIdx,
                            }"
                        ></div>
                    </div>
                </div>

                <Transition name="bounce" mode="out-in">
                    <div :key="currentStepIdx" id="stepIcon" class="flex flex-col items-center justify-center relative my-auto">
                        <Icon class="size-36 text-violet-400 drop-shadow-[0_0_25px_rgba(167,139,250,0.4)]" :icon="currentStep.icon" />
                        <h3 class="mt-6 text-xl font-medium text-neutral-300 text-center">{{ currentStep.title }}</h3>
                    </div>
                </Transition>

                <div class="text-xs text-neutral-500">
                    {{ isSpanish ? 'Pulsar Windows • Integración nativa de aplicaciones' : 'Pulsar Windows • Native App Integration' }}
                </div>
            </div>

            <!-- Right Side / Content -->
            <Transition name="bouncedown" mode="out-in">
                <div :key="currentStepIdx" id="stepContent" class="overflow-y-auto px-2 flex flex-col justify-center">
                    
                    <!-- PASO 1: Requisitos del Sistema -->
                    <div v-if="currentStep.id === StepID.PREREQUISITES" class="flex flex-col gap-5">
                        <div>
                            <h1 class="text-2xl font-bold text-white mb-2">
                                {{ isSpanish ? 'Comprobación del Sistema' : 'System Prerequisites' }}
                            </h1>
                            <p class="text-neutral-400 text-sm">
                                {{ isSpanish 
                                    ? 'Pulsar Windows utiliza virtualización KVM para ejecutar aplicaciones de Windows a velocidad nativa en tu equipo.' 
                                    : 'Pulsar Windows uses KVM virtualization to run Windows applications at native speed on your machine.' }}
                            </p>
                        </div>

                        <div class="bg-neutral-900/90 rounded-2xl p-4 border border-neutral-800 flex flex-col gap-3">
                            <!-- KVM -->
                            <div class="flex items-center justify-between py-1 border-b border-neutral-800/60">
                                <span class="text-sm font-medium text-neutral-300">
                                    {{ isSpanish ? 'Aceleración KVM / Virtualización' : 'KVM Virtualization / Hardware Acceleration' }}
                                </span>
                                <span v-if="specs.kvmEnabled" class="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                                    <Icon icon="mdi:check-circle" class="size-4" /> {{ isSpanish ? 'Activada' : 'Enabled' }}
                                </span>
                                <span v-else class="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                                    <Icon icon="mdi:close-circle" class="size-4" /> {{ isSpanish ? 'Desactivada (/dev/kvm)' : 'Disabled (/dev/kvm)' }}
                                </span>
                            </div>

                            <!-- Contenedor -->
                            <div class="flex items-center justify-between py-1 border-b border-neutral-800/60">
                                <span class="text-sm font-medium text-neutral-300">
                                    {{ isSpanish ? 'Motor de Contenedores' : 'Container Engine' }}
                                </span>
                                <div class="flex items-center gap-2">
                                    <span v-if="containerInstalled(containerSpecs)" class="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                                        <Icon icon="mdi:check-circle" class="size-4" /> {{ containerRuntime }}
                                    </span>
                                    <span v-else class="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                                        <Icon icon="mdi:close-circle" class="size-4" /> {{ isSpanish ? 'No encontrado' : 'Not found' }}
                                    </span>
                                </div>
                            </div>

                            <!-- FreeRDP 3 -->
                            <div class="flex items-center justify-between py-1 border-b border-neutral-800/60">
                                <span class="text-sm font-medium text-neutral-300">
                                    {{ isSpanish ? 'Protocolo Gráfico FreeRDP 3' : 'FreeRDP 3 RemoteApp Client' }}
                                </span>
                                <span v-if="specs.freeRDP3Installed" class="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                                    <Icon icon="mdi:check-circle" class="size-4" /> {{ isSpanish ? 'Disponible' : 'Available' }}
                                </span>
                                <span v-else class="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                                    <Icon icon="mdi:close-circle" class="size-4" /> {{ isSpanish ? 'No instalado' : 'Not installed' }}
                                </span>
                            </div>

                            <!-- RAM -->
                            <div class="flex items-center justify-between py-1">
                                <span class="text-sm font-medium text-neutral-300">
                                    {{ isSpanish ? 'Memoria RAM del Sistema' : 'System RAM' }}
                                </span>
                                <span class="text-xs text-neutral-400 font-mono">
                                    {{ specs.ramGB }} GB ({{ isSpanish ? 'Mínimo' : 'Minimum' }}: {{ MIN_HOST_RAM_GB }} GB)
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-3 mt-4">
                            <x-button
                                toggled
                                class="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium text-sm"
                                :disabled="!canProceedFromPrereqs"
                                @click="currentStepIdx++"
                            >
                                {{ isSpanish ? 'Continuar' : 'Continue' }}
                            </x-button>
                        </div>
                    </div>

                    <!-- PASO 2: Selección de Windows y Configuración Rápida -->
                    <div v-if="currentStep.id === StepID.WINDOWS_CONFIG" class="flex flex-col gap-5">
                        <div>
                            <h1 class="text-2xl font-bold text-white mb-2">
                                {{ isSpanish ? 'Selecciona tu versión de Windows' : 'Select your Windows version' }}
                            </h1>
                            <p class="text-neutral-400 text-sm">
                                {{ isSpanish 
                                    ? 'Tiny11 está optimizado para consumir el mínimo de memoria y disco, perfecto para cualquier ordenador.' 
                                    : 'Tiny11 is optimized to use minimal RAM and disk space, perfect for any machine.' }}
                            </p>
                        </div>

                        <!-- Tarjetas de selección -->
                        <div class="grid grid-cols-1 gap-2.5">
                            <!-- Opción 1: Tiny11 -->
                            <div
                                @click="selectWindowsVersion('tiny11')"
                                class="cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between"
                                :class="windowsVersion === 'tiny11' && !customIsoPath ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'"
                            >
                                <div class="flex items-center gap-3.5">
                                    <div class="p-2.5 rounded-lg bg-violet-500/20 text-violet-400">
                                        <Icon icon="mdi:flash" class="size-5" />
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-semibold text-white">Tiny11</span>
                                            <span class="text-[10px] bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full font-medium">
                                                {{ isSpanish ? 'Recomendado' : 'Recommended' }}
                                            </span>
                                        </div>
                                        <div class="text-xs text-neutral-400 mt-0.5">
                                            {{ isSpanish 
                                                ? 'Ultraligero, rápido y con mínimo consumo de RAM y almacenamiento.' 
                                                : 'Ultra-lightweight, fast, with minimal RAM and storage footprint.' }}
                                        </div>
                                    </div>
                                </div>
                                <Icon
                                    :icon="windowsVersion === 'tiny11' && !customIsoPath ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'"
                                    class="size-5 text-violet-400 shrink-0"
                                />
                            </div>

                            <!-- Opción 2: Windows 11 Pro -->
                            <div
                                @click="selectWindowsVersion('11')"
                                class="cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between"
                                :class="windowsVersion === '11' && !customIsoPath ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'"
                            >
                                <div class="flex items-center gap-3.5">
                                    <div class="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                                        <Icon icon="mage:microsoft-windows" class="size-5" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-white">
                                            {{ isSpanish ? 'Windows 11 Pro Oficial' : 'Windows 11 Pro Official' }}
                                        </div>
                                        <div class="text-xs text-neutral-400 mt-0.5">
                                            {{ isSpanish 
                                                ? 'Versión estándar completa descargada directamente desde Microsoft.' 
                                                : 'Complete standard edition downloaded directly from Microsoft.' }}
                                        </div>
                                    </div>
                                </div>
                                <Icon
                                    :icon="windowsVersion === '11' && !customIsoPath ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'"
                                    class="size-5 text-violet-400 shrink-0"
                                />
                            </div>

                            <!-- Opción 3: ISO Personalizada -->
                            <div
                                @click="selectIsoFile"
                                class="cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between"
                                :class="customIsoPath ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'"
                            >
                                <div class="flex items-center gap-3.5">
                                    <div class="p-2.5 rounded-lg bg-neutral-800 text-neutral-300">
                                        <Icon icon="line-md:folder-arrow-down-filled" class="size-5" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-white">
                                            {{ isSpanish ? 'Usar mi propia ISO' : 'Use custom ISO file' }}
                                        </div>
                                        <div class="text-xs text-neutral-400 mt-0.5">
                                            {{ customIsoFileName 
                                                ? (isSpanish ? `Seleccionada: ${customIsoFileName}` : `Selected: ${customIsoFileName}`) 
                                                : (isSpanish ? 'Seleccionar archivo .iso local en tu PC' : 'Select local .iso file on your machine') }}
                                        </div>
                                    </div>
                                </div>
                                <Icon
                                    :icon="customIsoPath ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank'"
                                    class="size-5 text-violet-400 shrink-0"
                                />
                            </div>
                        </div>

                        <!-- Acordeón Configuración Avanzada -->
                        <div class="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/40">
                            <button
                                @click="showAdvanced = !showAdvanced"
                                class="w-full px-4 py-2.5 text-xs font-semibold text-neutral-300 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
                            >
                                <span class="flex items-center gap-2">
                                    <Icon icon="mdi:cog" class="size-4 text-violet-400" />
                                    {{ isSpanish ? 'Opciones avanzadas (idioma, recursos y carpetas)' : 'Advanced options (language, resources and folders)' }}
                                </span>
                                <Icon :icon="showAdvanced ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="size-4" />
                            </button>

                            <div v-show="showAdvanced" class="p-4 pt-2 border-t border-neutral-800/80 flex flex-col gap-3 text-xs">
                                <!-- Selector de idioma -->
                                <div>
                                    <label class="text-neutral-400 block mb-1">
                                        {{ isSpanish ? 'Idioma de Windows (con fallback automático a Inglés):' : 'Windows Language (with automatic fallback to English):' }}
                                    </label>
                                    <select
                                        v-model="windowsLanguage"
                                        class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                                    >
                                        <option v-for="(name, banner) in WINDOWS_LANGUAGES" :key="name" :value="name">
                                            {{ banner }}
                                        </option>
                                    </select>
                                </div>

                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <label class="text-neutral-400 block mb-1">
                                            {{ isSpanish ? 'RAM asignada a la VM:' : 'Allocated VM RAM:' }}
                                        </label>
                                        <div class="flex items-center gap-2">
                                            <input
                                                type="number"
                                                v-model.number="ramGB"
                                                :min="MIN_VM_RAM_GB"
                                                :max="specs.ramGB || 16"
                                                class="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-white font-mono"
                                            />
                                            <span class="text-neutral-400">GB</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label class="text-neutral-400 block mb-1">
                                            {{ isSpanish ? 'Hilos de CPU:' : 'CPU Threads:' }}
                                        </label>
                                        <div class="flex items-center gap-2">
                                            <input
                                                type="number"
                                                v-model.number="cpuCores"
                                                :min="1"
                                                :max="specs.cpuCores || 8"
                                                class="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-white font-mono"
                                            />
                                            <span class="text-neutral-400">{{ isSpanish ? 'núcleos' : 'cores' }}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label class="text-neutral-400 block mb-1">
                                        {{ isSpanish ? 'Carpeta compartida con Windows (Unidad Z:):' : 'Shared folder with Windows (Drive Z:):' }}
                                    </label>
                                    <input
                                        type="text"
                                        v-model="sharedFolderPath"
                                        class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-neutral-300 font-mono text-[11px]"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Botones de acción -->
                        <div class="flex items-center justify-between mt-2">
                            <x-button class="px-5 py-2 text-sm text-neutral-400" @click="currentStepIdx--">
                                {{ isSpanish ? 'Atrás' : 'Back' }}
                            </x-button>

                            <x-button
                                toggled
                                class="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-medium text-sm"
                                @click="startInstall"
                            >
                                {{ isSpanish ? 'Instalar Pulsar Windows' : 'Install Pulsar Windows' }}
                            </x-button>
                        </div>
                    </div>

                    <!-- PASO 3: Instalación y Progreso -->
                    <div v-if="currentStep.id === StepID.INSTALL" class="flex flex-col gap-6 text-center">
                        <div>
                            <h1 class="text-2xl font-bold text-white mb-2">
                                {{ isSpanish ? 'Instalando Pulsar Windows' : 'Installing Pulsar Windows' }}
                            </h1>
                            <p class="text-neutral-400 text-sm">
                                {{ isSpanish 
                                    ? 'La máquina virtual se está aprovisionando de forma desatendida. Las aplicaciones instaladas se sincronizarán directamente en tu menú.' 
                                    : 'The virtual machine is being provisioned unattended. Installed applications will sync directly to your menu.' }}
                            </p>
                        </div>

                        <!-- Instalando / En progreso -->
                        <div
                            v-if="installState !== InstallStates.COMPLETED && installState !== InstallStates.INSTALL_ERROR"
                            class="flex flex-col items-center justify-center gap-4 py-8 bg-neutral-900/60 rounded-2xl border border-neutral-800"
                        >
                            <x-throbber class="size-14 text-violet-400"></x-throbber>
                            
                            <div class="flex flex-col gap-1">
                                <span class="text-base font-semibold text-white">
                                    {{ installState === InstallStates.MONITORING_PREINSTALL ? preinstallMsg : installState }}
                                </span>
                                <span class="text-xs text-neutral-400">
                                    {{ isSpanish ? 'Puedes ver el proceso en tiempo real' : 'You can follow the process in real time' }}
                                    <a :href="NOVNC_URL" @click="openAnchorLink" class="text-violet-400 underline ml-1">
                                        {{ isSpanish ? 'en tu navegador' : 'in your browser' }}
                                    </a>.
                                </span>
                            </div>
                        </div>

                        <!-- Error -->
                        <div
                            v-if="installState === InstallStates.INSTALL_ERROR"
                            class="flex flex-col items-center justify-center gap-3 py-6 bg-red-950/20 border border-red-800/50 rounded-2xl"
                        >
                            <Icon icon="mdi:alert-circle" class="size-12 text-red-400" />
                            <span class="text-sm font-medium text-red-200">
                                {{ isSpanish ? 'Se produjo un error al configurar Windows' : 'An error occurred while setting up Windows' }}
                            </span>
                            <span class="text-xs text-neutral-400">~/.local/share/pulsar-windows</span>
                        </div>

                        <!-- Completado -->
                        <div
                            v-if="installState === InstallStates.COMPLETED"
                            class="flex flex-col items-center justify-center gap-4 py-6 bg-green-950/20 border border-green-800/50 rounded-2xl"
                        >
                            <Icon icon="mdi:check-circle" class="size-14 text-green-400" />
                            <div>
                                <h3 class="text-lg font-bold text-white">
                                    {{ isSpanish ? '¡Instalación completada con éxito!' : 'Installation completed successfully!' }}
                                </h3>
                                <p class="text-xs text-neutral-300 mt-1">
                                    {{ isSpanish 
                                        ? 'Pulsar Windows ya está listo en segundo plano.' 
                                        : 'Pulsar Windows is now running in the background.' }}
                                </p>
                            </div>
                            <x-button
                                toggled
                                class="px-8 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm mt-2"
                                @click="$router.push('/home')"
                            >
                                {{ isSpanish ? 'Empezar a usar' : 'Get started' }}
                            </x-button>
                        </div>
                    </div>

                </div>
            </Transition>
        </div>
        <div class="absolute gradient-bg left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] -z-10"></div>
    </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { InstallConfiguration, Specs } from "../../types";
import { getSpecs, defaultSpecs } from "../lib/specs";
import {
    MIN_HOST_RAM_GB,
    MIN_VM_RAM_GB,
    NOVNC_URL,
    RECOMMENDED_VM_RAM_GB,
    WINDOWS_LANGUAGES,
    WINBOAT_DIR,
    type WindowsVersionKey,
} from "../lib/constants";
import { InstallManager, InstallStates } from "../lib/install";
import { WinboatConfig } from "../lib/config";
import { ContainerRuntimes, getContainerSpecs, type ContainerSpecs } from "../lib/containers/common";
import { openAnchorLink } from "../utils/openLink";

const path: typeof import("path") = require("node:path");
const electron: typeof import("electron") = require("electron").remote || require("@electron/remote");
const os: typeof import("os") = require("node:os");

type Step = {
    id: string;
    title: string;
    icon: string;
};

enum StepID {
    PREREQUISITES = "STEP_PREREQUISITES",
    WINDOWS_CONFIG = "STEP_WINDOWS_CONFIG",
    INSTALL = "STEP_INSTALL",
}

function detectSystemLanguage(): string {
    const locale = (
        (typeof navigator !== "undefined" && navigator.language) ||
        process.env.LANG ||
        process.env.LC_ALL ||
        ""
    ).toLowerCase();

    if (locale.startsWith("es")) return "Spanish";
    if (locale.startsWith("fr")) return "French";
    if (locale.startsWith("de")) return "German";
    if (locale.startsWith("it")) return "Italian";
    if (locale.startsWith("pt")) return "Portuguese";
    if (locale.startsWith("pl")) return "Polish";
    if (locale.startsWith("ru")) return "Russian";
    if (locale.startsWith("zh")) return "Chinese";
    if (locale.startsWith("ja")) return "Japanese";

    // Fallback to English on all other systems
    return "English";
}

const detectedLang = detectSystemLanguage();
const isSpanish = computed(() => detectedLang === "Spanish");

const steps = computed<Step[]>(() => [
    {
        id: StepID.PREREQUISITES,
        title: isSpanish.value ? "Requisitos del Sistema" : "System Prerequisites",
        icon: "line-md:check-all",
    },
    {
        id: StepID.WINDOWS_CONFIG,
        title: isSpanish.value ? "Elige tu Windows" : "Choose your Windows",
        icon: "mage:microsoft-windows",
    },
    {
        id: StepID.INSTALL,
        title: isSpanish.value ? "Instalación" : "Installation",
        icon: "line-md:downloading-loop",
    },
]);

const $router = useRouter();
const currentStepIdx = ref(0);
const currentStep = computed(() => steps.value[currentStepIdx.value]);

const specs = ref<Specs>({ ...defaultSpecs });
const containerRuntime = ref<ContainerRuntimes>(ContainerRuntimes.DOCKER);
const containerSpecs = ref<ContainerSpecs | undefined>(undefined);

// Advanced settings accordion
const showAdvanced = ref(false);

// Configuration options with smart defaults and automatic language detection
const windowsVersion = ref<WindowsVersionKey>("tiny11");
const windowsLanguage = ref(detectedLang);
const customIsoPath = ref("");
const customIsoFileName = ref("");
const cpuCores = ref(2);
const ramGB = ref(RECOMMENDED_VM_RAM_GB);
const diskSpaceGB = ref(64);
const username = ref("pulsar");
const password = ref("password");
const installFolder = ref(path.join(WINBOAT_DIR, "storage"));
const sharedFolderPath = ref(os.homedir());

const installState = ref<InstallStates>(InstallStates.IDLE);
const preinstallMsg = ref("");
let installManager: InstallManager | null = null;

const canProceedFromPrereqs = computed(() => {
    return (
        specs.value.kvmEnabled &&
        specs.value.freeRDP3Installed &&
        containerInstalled(containerSpecs.value)
    );
});

function containerInstalled(specs?: ContainerSpecs) {
    if (!specs) return false;
    if ("dockerInstalled" in specs) {
        return specs.dockerInstalled;
    }
    if ("podmanInstalled" in specs) {
        return specs.podmanInstalled;
    }
    return false;
}

function selectWindowsVersion(ver: WindowsVersionKey) {
    windowsVersion.value = ver;
    customIsoPath.value = "";
    customIsoFileName.value = "";
}

async function selectIsoFile() {
    const res = await electron.dialog.showOpenDialog({
        title: isSpanish.value ? "Selecciona una imagen ISO de Windows" : "Select Windows ISO image",
        filters: [{ name: "Imágenes de disco", extensions: ["iso"] }],
        properties: ["openFile"],
    });

    if (!res.canceled && res.filePaths.length > 0) {
        customIsoPath.value = res.filePaths[0];
        customIsoFileName.value = path.basename(res.filePaths[0]);
        windowsVersion.value = "custom";
    }
}

async function checkSpecs() {
    specs.value = await getSpecs();

    try {
        const dockerSpecs = await getContainerSpecs(ContainerRuntimes.DOCKER);
        if (dockerSpecs.dockerInstalled) {
            containerRuntime.value = ContainerRuntimes.DOCKER;
            containerSpecs.value = dockerSpecs;
        } else {
            const podmanSpecs = await getContainerSpecs(ContainerRuntimes.PODMAN);
            if (podmanSpecs.podmanInstalled) {
                containerRuntime.value = ContainerRuntimes.PODMAN;
                containerSpecs.value = podmanSpecs;
            } else {
                containerSpecs.value = dockerSpecs;
            }
        }
    } catch (e) {
        console.error("Error checking container specs:", e);
    }

    // Auto-calculate smart defaults based on detected hardware
    if (specs.value.cpuCores > 2) {
        cpuCores.value = Math.max(2, Math.floor(specs.value.cpuCores / 2));
    }
    if (specs.value.ramGB >= 8) {
        ramGB.value = Math.max(4, Math.floor(specs.value.ramGB / 2));
    } else {
        ramGB.value = 4;
    }
}

onMounted(async () => {
    await checkSpecs();
});

function startInstall() {
    currentStepIdx.value = 2; // Move to INSTALL step

    const installConfig: InstallConfiguration = {
        windowsVersion: windowsVersion.value,
        windowsLanguage: windowsLanguage.value,
        cpuCores: cpuCores.value,
        ramGB: ramGB.value,
        installFolder: installFolder.value,
        diskSpaceGB: diskSpaceGB.value,
        username: username.value,
        password: password.value,
        sharedFolderPath: sharedFolderPath.value,
        ...(customIsoPath.value ? { customIsoPath: customIsoPath.value } : {}),
        container: containerRuntime.value,
    };

    const wbConfig = WinboatConfig.getInstance();
    wbConfig.config.containerRuntime = containerRuntime.value;

    installManager = new InstallManager(installConfig);

    installManager.emitter.on("stateChanged", newState => {
        installState.value = newState;
    });

    installManager.emitter.on("preinstallMsg", msg => {
        preinstallMsg.value = msg;
    });

    installManager.install();
}
</script>

<style>
.gradient-bg {
    width: 90vw;
    height: 80vh;
    border-radius: 10px;
    background:
        linear-gradient(197.37deg, #7450db -0.38%, rgba(138, 234, 240, 0) 101.89%),
        linear-gradient(115.93deg, #3e88f6 4.86%, rgba(62, 180, 246, 0.33) 38.05%, rgba(62, 235, 246, 0) 74.14%),
        radial-gradient(
            56.47% 76.87% at 6.92% 7.55%,
            rgba(62, 136, 246, 0.7) 0%,
            rgba(62, 158, 246, 0.182) 52.16%,
            rgba(62, 246, 246, 0) 100%
        ),
        linear-gradient(306.53deg, #2ee4e3 19.83%, rgba(46, 228, 227, 0) 97.33%);
    background-blend-mode: normal, normal, normal, normal, normal, normal;
    filter: blur(50px);
}

/* Transitions */
.bounce-enter-active {
    animation: bounce-in 0.4s;
}
.bounce-leave-active {
    animation: bounce-in 0.4s reverse;
}

@keyframes bounce-in {
    0% {
        transform: scale(0.85);
        opacity: 0%;
    }
    100% {
        transform: scale(1);
        opacity: 100%;
    }
}

.bouncedown-enter-active {
    animation: bouncedown-in 0.4s;
}
.bouncedown-leave-active {
    animation: bouncedown-in 0.4s reverse;
}
@keyframes bouncedown-in {
    0% {
        transform: translateY(10px);
        opacity: 0%;
    }
    100% {
        transform: translateY(0);
        opacity: 100%;
    }
}
</style>
