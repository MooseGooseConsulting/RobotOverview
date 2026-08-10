/**
 * Source map for Hangar Hardware Library catalog keys.
 * Object keys are library_path with `beast/` stripped.
 * expectedSha256 comes from Datacore briefing beast-evidence-manifest (2026-07-01).
 */
export type LibrarySource = {
  docId: string;
  objectKey: string;
  expectedSha256: string | null;
  /** Prefer local paths first; then downloadUrl. */
  localCandidates: string[];
  downloadUrl?: string;
};

const CAD = '.tmp-cad-lfs/assets/hardware';

export const CATALOG_LIBRARY_SOURCES: LibrarySource[] = [
  {
    docId: 'doc-gdb-schematic',
    objectKey: '02-Driver-Board/General_Driver_for_Robots_Schematic.pdf',
    expectedSha256: 'dab698578c1b75bdf72a5ade4bada2d9f5a5da54f37737e1f41b0b2c59b9ce8a',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/upload/3/37/General_Driver_for_Robots.pdf',
  },
  {
    docId: 'doc-gdb-step',
    objectKey: '02-Driver-Board/General_Driver_for_Robots_STEP.zip',
    expectedSha256: '51e402703c5429a1068817a290a3078b994aecf87125f741ce0331ff1549eec8',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/upload/8/8e/General_Driver_for_Robots_STEP.zip',
  },
  {
    docId: 'doc-ups-schematic',
    objectKey: '03-Power-UPS/Ups01_Schematic.pdf',
    expectedSha256: 'ea654047e0c8ae1b8128ecf878ae69e976646ea504c1e6619432751eb452a3b2',
    localCandidates: [],
    downloadUrl: 'https://www.waveshare.com/w/upload/5/53/Ups01.pdf',
  },
  {
    docId: 'doc-ups-code',
    objectKey: '03-Power-UPS/UPS_Module_3S_Code.zip',
    expectedSha256: '734edc42fc017c8128235a5240d9239344f465ef0f52810db93d1b658e7a9d4e',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/upload/e/ea/UPS_Module_3S_Code.zip',
  },
  {
    docId: 'doc-st3215-manual',
    objectKey: '04-Servos/ST3215_Servo_User_Manual.pdf',
    expectedSha256: 'f37f43544e674e5eaf87c5a134f575fb37d207f2269f6e8c60328d9a82918d49',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/upload/f/f4/ST3215_Servo_User_Manual.pdf',
  },
  {
    docId: 'doc-st-protocol',
    objectKey: '04-Servos/ST_Servo_Communication_Protocol_Manual.pdf',
    expectedSha256: '3bf67ac6e28ac37e98a083ce1c32201801123b065d01632350c54fd1d184af5a',
    localCandidates: [],
    downloadUrl:
      'https://files.waveshare.com/upload/2/27/Communication_Protocol_User_Manual-EN%28191218-0923%29.pdf',
  },
  {
    docId: 'doc-st-circuit',
    objectKey: '04-Servos/ST_Bus_Servo_Control_Circuit.pdf',
    expectedSha256: '2d732e7bbaa7fb0ca70da324030b41f50ec39033dba2cfa35234e2be323bcbf4',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/upload/d/d3/Bus_servo_control_circuit.pdf',
  },
  {
    docId: 'doc-beast-cad',
    objectKey: '05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip',
    expectedSha256: 'bf649936f7663c7e4520fe4e45aa02d0b5ae588e5c200229a1f2cbfdcd9b7631',
    localCandidates: [`${CAD}/pi/UGV_Beast_PT_AI_Kit_step.zip`],
    downloadUrl: 'https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PT_AI_Kit_step.zip',
  },
  {
    docId: 'doc-orin-3d',
    objectKey: '06-Jetson-Orin/UGV_Beast_PT_Jetson_Orin_3D.zip',
    expectedSha256: '56615c77a93b90b760e6e2277de55ff36fe8ff610f77d2fedb197ca0d6f879b4',
    localCandidates: [`${CAD}/orin/UGV_Beast_PT_Jetson_Orin-3D.zip`],
    downloadUrl:
      'https://files.waveshare.com/wiki/UGV-Beast-PT-Jetson-Orin-AI-Kit/UGV_Beast_PT_Jetson_Orin-3D.zip',
  },
  {
    docId: 'doc-esp32-firmware',
    objectKey: '07-Code-Firmware/UGV01_BASE_ESP32_Firmware.zip',
    expectedSha256: '5daf339df0a8ca879230d806b8d5d62d65703b4e243b4827682077770bbef4e5',
    // Do not use keyArtifactstosort waveshareteam_ugv_base_ros_ESP32_firmware.zip — different archive.
    localCandidates: ['.tmp-library-staging/07-Code-Firmware/UGV01_BASE_ESP32_Firmware.zip'],
    downloadUrl: 'https://files.waveshare.com/upload/0/0c/UGV01_BASE.zip',
  },
  {
    docId: 'doc-cp210x-driver',
    objectKey: '07-Code-Firmware/CP210x_USB_TO_UART_Driver.zip',
    expectedSha256: '7cb2b9b40e5279e55409e84b3f018744b1aae9c06ac9779e549e7d19b5ad67b3',
    localCandidates: [],
    downloadUrl: 'https://files.waveshare.com/wiki/common/CP210x_USB_TO_UART.zip',
  },
  // Wiki: 2026-07-01 .md snapshots are gone with UGV-Beast-Archive. Fresh HTML
  // captures are staged under .tmp-library-staging (hashes intentionally unset).
  {
    docId: 'doc-gdb-wiki',
    objectKey: '08-Wiki-Pages/General-Driver-for-Robots_Wiki.md',
    expectedSha256: null,
    localCandidates: ['.tmp-library-staging/08-Wiki-Pages/General-Driver-for-Robots_Wiki.md'],
    downloadUrl: 'https://www.waveshare.com/wiki/General_Driver_for_Robots',
  },
  {
    docId: 'doc-ups-wiki',
    objectKey: '08-Wiki-Pages/UPS-Module-3S_Wiki.md',
    expectedSha256: null,
    localCandidates: ['.tmp-library-staging/08-Wiki-Pages/UPS-Module-3S_Wiki.md'],
    downloadUrl: 'https://www.waveshare.com/wiki/UPS_Module_3S',
  },
  {
    docId: 'doc-beast-wiki',
    objectKey: '08-Wiki-Pages/UGV-Beast_Wiki.md',
    expectedSha256: null,
    localCandidates: ['.tmp-library-staging/08-Wiki-Pages/UGV-Beast_Wiki.md'],
    downloadUrl: 'https://www.waveshare.com/wiki/UGV-Beast',
  },
  {
    docId: 'doc-beast-product',
    objectKey: '08-Wiki-Pages/UGV-Beast_Product-Page.md',
    expectedSha256: null,
    localCandidates: ['.tmp-library-staging/08-Wiki-Pages/UGV-Beast_Product-Page.md'],
    downloadUrl: 'https://www.waveshare.com/ugv-beast.htm',
  },
  {
    docId: 'doc-orin-wiki',
    objectKey: '08-Wiki-Pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md',
    expectedSha256: null,
    localCandidates: [
      '.tmp-library-staging/08-Wiki-Pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md',
    ],
    downloadUrl: 'https://www.waveshare.com/wiki/UGV_Beast_PT_Jetson_Orin_AI_Kit',
  },
];

/** Non-catalog CAD retained under extra/ so LFS side-stash content is not lost. */
export const EXTRA_LIBRARY_SOURCES: LibrarySource[] = [
  {
    docId: 'extra-pi-pt-3d',
    objectKey: 'extra/UGV_Beast_PT_AI_Kit_3D.zip',
    expectedSha256: '33db3df8d1ad24a92a1a74ce0d5360ec78950fa421e48bc5e780acc76e038c9a',
    localCandidates: [`${CAD}/pi/UGV_Beast_PT_AI_Kit_3D.zip`],
  },
  {
    docId: 'extra-pi4b-step',
    objectKey: 'extra/UGV_Beast_PI4B_AI_Kit_step.zip',
    expectedSha256: 'b52f72922132568b8728d14c39c783edca1bb13bd1b5f0c694bde3e15c577f27',
    localCandidates: [`${CAD}/pi/UGV_Beast_PI4B_AI_Kit_step.zip`],
  },
  {
    docId: 'extra-pi4b-3d',
    objectKey: 'extra/UGV_Beast_PI4B_AI_Kit_3D.zip',
    expectedSha256: 'cb7d51373314daa966dff26a30cb04d05adcf7c8d57e03341516f6b0f6e74259',
    localCandidates: [`${CAD}/pi/UGV_Beast_PI4B_AI_Kit_3D.zip`],
  },
  {
    docId: 'extra-rover-orin-step',
    objectKey: 'extra/UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip',
    expectedSha256: null,
    localCandidates: [`${CAD}/orin/UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip`],
  },
  {
    docId: 'extra-rover-orin-2d',
    objectKey: 'extra/UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip',
    expectedSha256: null,
    localCandidates: [`${CAD}/orin/UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip`],
  },
  {
    docId: 'extra-driver-board-pdf',
    objectKey: 'extra/DriverBoardBeastOrin.pdf',
    expectedSha256: 'b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5',
    localCandidates: [`${CAD}/orin/DriverBoardBeastOrin.pdf`],
  },
];
