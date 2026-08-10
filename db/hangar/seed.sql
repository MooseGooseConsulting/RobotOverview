BEGIN;
SET client_min_messages = warning;

-- hangar_meta
INSERT INTO hangar_meta(id,title,operator,codename,updated) VALUES ('hangar','THE HANGAR','Patrick MacLyman','FLEET COMMAND','2026-07-22');

-- groups (bays)
INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES ('robotics','bay','Robotics Bay','RBT','Rovers · arms · drones','cyan');
INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES ('compute','bay','Compute Core','CMP','Workstations · edge · brains','amber');
INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES ('network','bay','Network Ops','NET','Gateways · radios · eyes','cyan');
INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES ('home','bay','Home Systems','HOME','Automation · climate · power','amber');
INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES ('audio','bay','Audio Lab','AUD','Transducers · signal chain','cyan');

-- tags
INSERT INTO tags(namespace,name,label) VALUES ('tag','rover','rover') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','flagship','flagship') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','waveshare','waveshare') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','acce','acce') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','ros2','ros2') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','cutover','cutover') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Tracked ROS2 Rover','Tracked ROS2 Rover') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','camera','camera') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','depth','depth') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','oak','oak') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','beast','beast') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','RGB-D Camera','RGB-D Camera') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','lidar','lidar') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','dtof','dtof') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','mapping','mapping') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','2D LiDAR','2D LiDAR') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','power','power') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','ups','ups') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Power Module','Power Module') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','controller','controller') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','esp32','esp32') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Robot Controller Board','Robot Controller Board') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','placeholder','placeholder') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','expansion','expansion') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Unassigned bay','Unassigned bay') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','blackwell','blackwell') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','5090','5090') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','workstation','workstation') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','cuda','cuda') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Workstation · Off-board Brain','Workstation · Off-board Brain') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','pi','pi') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','sbc','sbc') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','spare','spare') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','SBC · Onboard I/O','SBC · Onboard I/O') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','jetson','jetson') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','orin','orin') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','ampere','ampere') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','edge-ai','edge-ai') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Edge AI Module','Edge AI Module') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','thor','thor') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','industrial','industrial') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Edge AI — Industrial Tier','Edge AI — Industrial Tier') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','unifi','unifi') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','gateway','gateway') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','homelab','homelab') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Gateway · Controller','Gateway · Controller') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','wifi','wifi') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','coverage','coverage') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Access Points','Access Points') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','ptz','ptz') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Surveillance','Surveillance') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','home-assistant','home-assistant') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','thread','thread') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','automation','automation') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Automation Hub','Automation Hub') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','audio','audio') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','headset','headset') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','planar','planar') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Open-back Planar Headset','Open-back Planar Headset') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','kvm','kvm') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','usb-c','usb-c') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','wifi-6','wifi-6') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','glinet','glinet') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','kickstarter','kickstarter') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Remote KVM','Remote KVM') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','rack','rack') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','poe','poe') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Rack KVM','Rack KVM') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','matter','matter') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','presence','presence') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','mmwave','mmwave') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','pir','pir') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Presence Sensor','Presence Sensor') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Lighting','Lighting') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Sensing','Sensing') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('category','Audio','Audio') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','usb','usb') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','gotcha','gotcha') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','method','method') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','documentation','documentation') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','debugging','debugging') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','lighting','lighting') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','fpv','fpv') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','crawlspace','crawlspace') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','safety','safety') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','offload','offload') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','control','control') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','network','network') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','latency','latency') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','operations','operations') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','telemetry','telemetry') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','historical','historical') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','architecture','architecture') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','autonomy','autonomy') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','decision','decision') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','sensing','sensing') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','calibration','calibration') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','compute','compute') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','tiering','tiering') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','software','software') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','policy','policy') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','llm','llm') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','vla','vla') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','cosmos','cosmos') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','teleop','teleop') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','undercroft','undercroft') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','north-star','north-star') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','perception','perception') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','edge','edge') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','sizing','sizing') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','deployment','deployment') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','shipwright','shipwright') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','ghcr','ghcr') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','kubernetes','kubernetes') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','vision','vision') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','research','research') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','splat','splat') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','gaussian','gaussian') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','colmap','colmap') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','3dgs','3dgs') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','arducam','arducam') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','b0497','b0497') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','imx678','imx678') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','starvis','starvis') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','rejected','rejected') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','thermal','thermal') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','zoom','zoom') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','livox','livox') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','mid-360','mid-360') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','robosense','robosense') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','airy','airy') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','extrinsic','extrinsic') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','time-sync','time-sync') ON CONFLICT (namespace,name) DO NOTHING;

-- assets: units
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('beast','system','UGV Beast',NULL,NULL,'BEAST-01','blocked',NULL,'owner',true,'Waveshare UGV Beast PT PI5 ROS2 Kit Acce (owner-confirmed 2026-07-27) with the stock pan-tilt 5MP camera, OAK-D Lite depth camera, and D500 LiDAR — all three ship with the ROS2 Kit; "Acce" means the host board was supplied separately. First unit of the fleet. Orin cutover: Jetson Orin Nano Super fitted and pack-powered via the UPS barrel pigtail (not driver-board USB-C). Live-verified 2026-07-30: ROS 2 Humble + ugv_ws at boot (`beast-ros-base.service`, lidar/odom/EKF up, allow_motion:=false); ESP32 + LiDAR talk over USB serial (/dev/ttyACM*), not GPIO UART jumpers. Heartbeat-stop test FAILED 2026-07-31 — do not enable motion without an operator stop path. Robot VLAN 192.168.20.x rejected — LAN 192.168.0.x + Tailscale. One host mounting strut still missing.',NULL,NULL,NULL,'2026',NULL,1,25,5,'5V',3200,NULL,NULL,'[{"label":"Chassis","value":"Tracked, all-terrain · slow, hard-stopping"},{"label":"Onboard host","value":"Jetson Orin Nano Super — fitted · ROS base at boot (2026-07-30)"},{"label":"Motor control","value":"ESP32 (PID) over USB serial · motion software-locked"},{"label":"Pan-tilt camera","value":"5MP · 160° · USB"},{"label":"Depth camera","value":"OAK-D Lite · USB"},{"label":"LiDAR","value":"D500 / STL-19P · 360° · USB serial bridge"},{"label":"Pack","value":"3S Li-ion (~11.1V)"},{"label":"Control","value":"ROS 2 teleop over SSH · no web dashboard · watchdog gap"}]'::jsonb,'[{"label":"Waveshare UGV Beast","url":"https://www.waveshare.com/ugv-beast.htm"},{"label":"Waveshare UGV hardware tutorial","url":"https://www.youtube.com/watch?v=8wqPs7rNkJ4"}]'::jsonb,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('oak-d-lite','module','Luxonis OAK-D Lite',NULL,NULL,'BEAST-RGBD','integrating',NULL,'owner',false,'OAK-D Lite depth and AI camera installed as part of the BEAST-01 ACCE ROS2 kit.',NULL,NULL,NULL,'included',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Role","value":"Stereo depth · RGB · onboard vision"},{"label":"Interface","value":"USB"},{"label":"ROS","value":"depthai_ros_driver"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('d500-lidar','module','Waveshare D500 LiDAR',NULL,NULL,'BEAST-LIDAR','integrating',NULL,'owner',false,'D500 360° DTOF LiDAR installed as part of the BEAST-01 ACCE ROS2 kit; the sensor core is STL-19P/LDS19.',NULL,NULL,NULL,'included',NULL,1,1.45,5,'5V',NULL,NULL,NULL,'[{"label":"Sensor","value":"STL-19P / LDS19"},{"label":"Range","value":"0.03–12 m"},{"label":"Scan","value":"360° · 10 Hz · 5000 samples/s"},{"label":"Interface","value":"UART · 230400 baud · USB bridge to host"},{"label":"ROS model","value":"LDLIDAR_MODEL=ld19"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('stock-ups','module','Stock 3x18650 UPS',NULL,NULL,'BEAST-PWR','operational',NULL,'owner',false,'Stock undercarriage UPS module installed in BEAST-01, with room for 3x 18650 cells and external 3S pack experiments.',NULL,NULL,NULL,'included',NULL,1,NULL,11.1,'battery',NULL,NULL,NULL,'[{"label":"Cells","value":"3x 18650"},{"label":"Chassis slot","value":"Undercarriage Bay"},{"label":"Expansion","value":"External 3S packs via XH2.54 input"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('driver-board','module','General Driver for Robots',NULL,NULL,'BEAST-CTL','operational',NULL,'owner',false,'Waveshare ESP32-WROOM-32 driver board at the heart of BEAST-01: motor H-bridge, ST3215 servo bus, 5V host rail for the Pi, IMU, and battery telemetry on one 65×65mm PCB.',NULL,NULL,NULL,'included',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"MCU","value":"ESP32-WROOM-32"},{"label":"Power in","value":"XH2.54 · DC 7–13V"},{"label":"Motor driver","value":"TB6612FNG dual H-bridge"},{"label":"Servo bus","value":"ST3215 TTL @ 1 Mbps (5A limit)"},{"label":"Host rail","value":"5V buck (MP8759, ~5A) via 40-pin"},{"label":"Telemetry","value":"INA219 V/I sense · IMU · OLED I²C"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('rover-slot-2','module','Open Rover Slot',NULL,NULL,NULL,'planned',NULL,'inferred',false,'Reserved bay for the next ground unit or aerial drone as the fleet grows.',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Status","value":"Empty — future acquisition"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('workstation','module','Threadripper / RTX 5090',NULL,NULL,'CORE-PRIME','operational',NULL,'owner',true,'Blackwell-class desktop. Fleet brain for training and heavy perception/VLA inference. On the slow hard-stopping Beast, remote closed-loop over WiFi 6 is first-class alongside on-device Orin — the network tail is a design input, not a teleop veto.',NULL,NULL,NULL,'owned',NULL,1,600,NULL,'mains',NULL,NULL,NULL,'[{"label":"GPU","value":"RTX 5090 · 32GB GDDR7"},{"label":"Arch","value":"Blackwell"},{"label":"CPU","value":"Threadripper"},{"label":"Role","value":"Train + offboard inference"},{"label":"Link","value":"WiFi 6 LAN to fleet"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('pi5','module','Raspberry Pi 5',NULL,NULL,'EDGE-PI','retired',NULL,'owner',false,'Former Beast upper computer — removed 2026-07-22 for the Orin Nano cutover. Kept in inventory as a spare SBC. No CUDA; when it was onboard it handled teleop, streaming, I/O, and the stale-command watchdog on the constrained 5V/5A rail.',NULL,NULL,NULL,'owned',NULL,1,25,5,'5V',NULL,NULL,NULL,'[{"label":"SoC","value":"BCM2712 · quad A76"},{"label":"GPU","value":"VideoCore (no CUDA)"},{"label":"Rail","value":"5V / 5A — protect it"},{"label":"Role","value":"Spare · former Beast host"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('orin-nano','module','Jetson Orin Nano Super',NULL,NULL,'BEAST-JETSON','integrating',NULL,'owner',false,'Owned NVIDIA Jetson Orin Nano 8GB developer kit — JetPack 6.2.2 / R36.5 on NVMe, ROS 2 Humble and ugv_ws built. Physically fitted into BEAST-01; live 2026-07-30: beast-ros-base.service at boot, ESP32+LiDAR over USB serial, motion locked (allow_motion:=false). Powered from the pack via the UPS board barrel-jack lead, not the driver board back-feed path. Heartbeat-stop gap (2026-07-31) and missing mount strut remain before unsupervised drive.',NULL,NULL,NULL,'owned',NULL,1,25,NULL,'battery',NULL,249,NULL,'[{"label":"AI perf","value":"up to 67 TOPS (Super); ~1.7× prior"},{"label":"Arch","value":"Ampere GPU + 6-core Arm"},{"label":"Power","value":"7–25 W"},{"label":"Memory","value":"8 GB"},{"label":"Cameras","value":"2× MIPI CSI (4-lane)"},{"label":"Carrier","value":"Accepts Orin Nano + Orin NX"},{"label":"Stack","value":"CUDA · TensorRT · Isaac ROS"},{"label":"Lifecycle","value":"through 2032"},{"label":"Cutover","value":"Fitted · ROS base live · motion locked · HB gap"}]'::jsonb,'[{"label":"NVIDIA Jetson Orin","url":"https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/"}]'::jsonb,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('jetson-thor','module','Jetson Thor (T4000)',NULL,NULL,NULL,'researching',NULL,'inferred',false,'Blackwell in an embedded module — but the wrong tier for a hobby rover. Built for humanoids and industrial AMRs. Logged for the research horizon, not the buy list.',NULL,NULL,NULL,NULL,'Q2 2026 · wrong tier',1,75,NULL,'battery',NULL,1999,NULL,'[{"label":"AI perf","value":"1,200 FP4 TFLOPS"},{"label":"Arch","value":"Blackwell"},{"label":"Power","value":"40–75 W"},{"label":"Memory","value":"64 GB"},{"label":"Price","value":"~$1,999 @ 1k vol"},{"label":"Avail","value":"~Q2 2026"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('udm-pro-max','module','UniFi UDM Pro Max',NULL,NULL,'GATEWAY','operational',NULL,'owner',false,'Core of Network Ops — gateway, controller, and the spine the offload link rides on.',NULL,NULL,'Home Assistant','owned',NULL,1,33,NULL,'mains',NULL,NULL,NULL,'[{"label":"Role","value":"Gateway + UniFi controller"},{"label":"Uplink","value":"10G homelab switching"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('unifi-aps','module','UniFi WiFi 7 APs',NULL,NULL,NULL,'operational',NULL,'owner',false,'In-wall + outdoor APs providing the 5GHz / WiFi 6+ coverage the offload architecture depends on. Coverage = autonomy range when the brain is off-board.',NULL,NULL,NULL,'owned',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Units","value":"U7 in-wall + outdoor"},{"label":"Role","value":"Fleet uplink / coverage"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('unifi-cams','module','UniFi G6 PTZ Cameras',NULL,NULL,NULL,'operational',NULL,'owner',false,'PTZ camera coverage across the property — eyes for the base, distinct from on-rover sensing.',NULL,NULL,'Home Assistant','owned',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Type","value":"G6 PTZ"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('home-assistant','module','Home Assistant Hub',NULL,NULL,'HA-CORE','operational',NULL,'owner',false,'Whole-home automation brain with a Thread border router. Hangar catalogs its role; Home Assistant remains the home-automation control plane.',NULL,NULL,NULL,'owned',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Thread","value":"ZBT-2 border router"},{"label":"Climate","value":"Ecobee"},{"label":"Pool","value":"Pentair via Elfin EW11"},{"label":"Irrigation","value":"B-hyve"},{"label":"Energy","value":"Emporia Vue"},{"label":"Display","value":"LG C5 OLED"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('rog-kithara','module','Asus ROG Kithara',NULL,NULL,NULL,'operational',NULL,'owner',false,'Current daily driver in the Audio Lab; anchor for an Audeze-heavy wishlist.',NULL,NULL,NULL,'owned',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"Type","value":"Open-back planar"}]'::jsonb,NULL,NULL,NULL);

-- asset_shortcuts (unit shortcuts; position = array index)
INSERT INTO asset_shortcuts(asset_id,shortcut_id,position,label,type,url,command,note) VALUES ('beast','ssh',0,'SSH','command',NULL,'ssh beast-01','LAN preferred (beast-01.local). Off-LAN: ssh beast-01-ts (100.107.16.72). Not the Pi-era robot VLAN.');

-- assets: inventory items
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('glinet-comet-q-gl-rmq1','peripheral','Comet Q','GL.iNet','GL-RMQ1',NULL,'on-order','on-order','owner',false,'Palm-sized USB-C remote KVM for controlling one USB-C target device from a browser or GLKVM app over Wi-Fi 6.','Comet Q is the mobile-device and compact-host member of the Comet KVM line. It connects to a target over USB-C and depends on the target supporting DisplayPort Alt Mode, then exposes remote keyboard, video, and mouse control through a browser or app. It is useful for Mac minis, closed-lid laptops, iPhone/iPad test devices, kiosks, and small homelab machines where physical monitor and keyboard access is inconvenient.','Treat as a single-target convenience KVM for USB-C video devices, not as a replacement for HDMI rack KVMs. Best Hangar placement is Network Ops until assigned to a specific unit or service workflow.',NULL,'2026 Kickstarter pledge','Estimated shipping Aug 2026',1,NULL,NULL,NULL,NULL,89,NULL,'[{"label":"OS","value":"Buildroot"},{"label":"CPU","value":"ARM Cortex, quad-core"},{"label":"Memory / storage","value":"512 MB LPDDR4 / 512 MB NAND"},{"label":"Display","value":"1.8 in touchscreen"},{"label":"Wireless","value":"Wi-Fi 6, IEEE 802.11 a/b/g/n/ac/ax"},{"label":"Wi-Fi speed","value":"5 GHz: 286 Mbps; 2.4 GHz: 286 Mbps"},{"label":"Video","value":"2K QHD @ 60 FPS"},{"label":"Interface","value":"USB-C power passthrough plus USB-C cable with DP Alt Mode support"},{"label":"Power input","value":"USB-C PD, 5V/3A"}]'::jsonb,NULL,'["Requires USB-C DisplayPort Alt Mode on the controlled device.","Controls one target at a time.","Not the right tool for older HDMI-only servers without an adapter path."]'::jsonb,'[{"label":"GL.iNet Comet Q product page","url":"https://www.gl-inet.com/products/gl-rmq1/","accessedAt":"2026-06-16","kind":"official"},{"label":"CNX Software Comet Q crowdfunding coverage","url":"https://www.cnx-software.com/2026/06/03/comet-q-usb-c-kvm-device-is-made-for-smartphones-tablets-and-laptops-crowdfunding/","accessedAt":"2026-06-16","kind":"review"}]'::jsonb);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('glinet-comet-x-gl-rm4pe','peripheral','Comet X','GL.iNet','GL-RM4PE',NULL,'on-order','on-order','owner',false,'Quad-port remote KVM with PoE for managing up to four nearby hosts from a browser, app, or local rack console.','Comet X is the rack and homelab member of the Comet line. It provides four HDMI inputs, four USB-C device ports for host control, a local HDMI output, USB-A host ports for peripherals, and remote browser/app access. Its 64 GB eMMC storage is positioned as an image repository for ISO storage, OS deployment, and emergency recovery.','This belongs in Network Ops as the likely rack-side management point for grouped mini PCs, servers, or test hosts. It should be modeled as an item first, then linked to specific units once those hosts are attached.',NULL,'2026 Kickstarter add-on','Estimated shipping Aug 2026',1,NULL,NULL,NULL,NULL,202,NULL,'[{"label":"OS","value":"Linux 6.1"},{"label":"CPU","value":"ARM Cortex, quad-core"},{"label":"Memory / storage","value":"1 GB DDR3L / 64 GB eMMC"},{"label":"Host inputs","value":"4 x HDMI IN; 4 x USB 2.0 Type-C device ports"},{"label":"Local console","value":"1 x HDMI OUT; 7 x USB 2.0 Type-A host ports"},{"label":"Network","value":"1 x RJ45, 10/100/1000 Mbps, 802.3af/at PoE"},{"label":"Display","value":"3.69 in TFT touchscreen"},{"label":"Video","value":"4K @ 30 FPS"},{"label":"Power input","value":"Ethernet PoE or optional USB-C 5V/3A PD"},{"label":"Dimensions / weight","value":"170 x 90 x 40 mm / 560 g"},{"label":"Rack mounting","value":"Compatible with 10 in and 19 in racks; brackets included"}]'::jsonb,NULL,'["Controls up to four hosts.","Video handling is listed as 4K @ 30 FPS, not 4K @ 60 FPS.","USB host ports are USB 2.0 and rated 5V/0.5A per port.","No cellular failover is listed for this model."]'::jsonb,'[{"label":"GL.iNet Comet X product page","url":"https://www.gl-inet.com/products/gl-rm4pe/","accessedAt":"2026-06-16","kind":"official"},{"label":"NAS Compares Comet X coverage","url":"https://nascompares.com/2026/05/28/gl-inet-comet-x-kvm-host-revealed/","accessedAt":"2026-06-16","kind":"review"}]'::jsonb);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('lafaer-lwr02-presence-sensor','peripheral','LWR02 All-in-One Wireless Presence Sensor','GL.iNet / Lafaer','LWR02',NULL,'on-order','on-order','owner',false,'Matter-over-Thread 5-in-1 smart-home sensor combining PIR, mmWave presence detection, ambient light, temperature, and humidity.','LWR02 is a battery-powered occupancy and environment sensor for smart-home automations. PIR covers larger motion events while mmWave radar helps maintain presence when a person is relatively still. The sensor reports movement or presence, ambient light, temperature, humidity, and battery percentage to compatible Matter ecosystems.','Best initial placement is Home Systems. It can become a useful occupancy signal for lights, HVAC context, bathroom/kitchen automations, and future Hangar references to room state, but the Hangar should catalog it rather than operate the home.',NULL,'2026 Kickstarter add-on','Estimated shipping Aug 2026',1,NULL,NULL,NULL,NULL,36,NULL,'[{"label":"Sensors","value":"Presence, motion, ambient light, temperature, humidity"},{"label":"Detection method","value":"PIR plus mmWave radar"},{"label":"Battery","value":"2 x AAA, rechargeable AAA supported"},{"label":"Battery life","value":"Claimed 2+ years"},{"label":"Detection range","value":"Presence: 4 m / 13.1 ft; motion: 8 m / 26.2 ft"},{"label":"Detection angle","value":"Approx. 120 degrees"},{"label":"Protocol","value":"Matter over Thread"},{"label":"Wireless","value":"IEEE 802.15.4, 2.4 GHz"},{"label":"Dimensions","value":"Device only: 71 x 46 x 36 mm; with stand: 71 x 46 x 49 mm"},{"label":"Operating temperature","value":"0-40 C / 32-104 F"},{"label":"Protection rating","value":"IPX3"},{"label":"Matter certification","value":"CSA262BRMAT52423-24; spec 1.4.2; certified 2026-05-06"}]'::jsonb,NULL,'["Requires a Matter-capable platform and a Thread Border Router.","Horizontal installation is recommended; vertical installation is explicitly not advised unless angled downward from target height.","Avoid aiming at large glass surfaces, fans, curtains, or other moving objects to reduce false triggers.","IPX3 is splash resistance, not outdoor weatherproofing or submersion.","GL.iNet does not publish mmWave frequency, lux accuracy, temperature/humidity accuracy, reporting interval, zone mapping, or multi-person tracking specs."]'::jsonb,'[{"label":"GL.iNet LWR02 product page","url":"https://www.gl-inet.com/en-us/products/lwr02","accessedAt":"2026-06-16","kind":"official"},{"label":"CSA Matter certification record","url":"https://csa-iot.org/csa_product/all-in-one-wireless-presence-sensor/","accessedAt":"2026-06-16","kind":"certification"}]'::jsonb);

-- assets: wishlist (folded in, lifecycle=wishlist). wishlist_meta deferred (needs caps/missions).
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('light-bar','module','RC Crawler Aluminum LED Light Bar',NULL,NULL,NULL,'buy-next','wishlist','inferred',false,'Wide flood, rugged, 2S–3S input — runs off the battery rail, not the Pi. Mount forward + angled down ~15–20° to light the floor without blasting dust at lens level.',NULL,NULL,NULL,NULL,NULL,1,8,NULL,'battery',85,35,18,NULL,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('crawler-led-kit','module','INJORA / MEUS Crawler LED Kit',NULL,NULL,NULL,'watching','wishlist','inferred',false,'Cheapest path — multiple small LEDs you can place and offset individually off the lens axis.',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,18,10,NULL,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('depth-cam','module','Integrated Depth Camera (Orbbec-class)',NULL,NULL,NULL,'researching','wishlist','inferred',false,'Factory-calibrated RGB-D on one USB stream — erases camera intrinsics, extrinsics, and time-sync work. Computes depth onboard, so the host streams it without a GPU. The "reach high but solve power" first step.',NULL,NULL,NULL,NULL,NULL,1,5,5,'5V',140,230,NULL,NULL,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('standalone-lidar','module','Standalone LiDAR (~$500 class)',NULL,NULL,NULL,'researching','wishlist','inferred',false,'Mind-blowing range/coverage but LiDAR-only. Adds extrinsic calibration + time-sync burden, and more total draw — compounds the Pi power problem. Defer until the pipeline exists.',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,500,420,NULL,NULL,NULL,NULL);
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('audeze-mm100','module','Audeze MM-100',NULL,NULL,NULL,'watching','wishlist','inferred',false,'Top of the Audio Lab planar wishlist.',NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,399,NULL,NULL,NULL,NULL,NULL);

-- asset_groups (bay membership) + asset_tags
INSERT INTO asset_groups(asset_id,group_id) VALUES ('beast','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='rover' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='flagship' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='waveshare' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='acce' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='ros2' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='tag' AND name='cutover' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'beast',id FROM tags WHERE namespace='class' AND name='Tracked ROS2 Rover' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('oak-d-lite','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='tag' AND name='camera' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='tag' AND name='depth' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='tag' AND name='oak' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='tag' AND name='acce' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'oak-d-lite',id FROM tags WHERE namespace='class' AND name='RGB-D Camera' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('d500-lidar','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='tag' AND name='lidar' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='tag' AND name='dtof' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='tag' AND name='mapping' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='tag' AND name='acce' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'd500-lidar',id FROM tags WHERE namespace='class' AND name='2D LiDAR' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('stock-ups','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'stock-ups',id FROM tags WHERE namespace='tag' AND name='power' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'stock-ups',id FROM tags WHERE namespace='tag' AND name='ups' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'stock-ups',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'stock-ups',id FROM tags WHERE namespace='class' AND name='Power Module' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('driver-board','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='controller' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='esp32' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='waveshare' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='class' AND name='Robot Controller Board' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('rover-slot-2','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rover-slot-2',id FROM tags WHERE namespace='tag' AND name='placeholder' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rover-slot-2',id FROM tags WHERE namespace='tag' AND name='expansion' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rover-slot-2',id FROM tags WHERE namespace='class' AND name='Unassigned bay' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('workstation','compute') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'workstation',id FROM tags WHERE namespace='tag' AND name='blackwell' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'workstation',id FROM tags WHERE namespace='tag' AND name='5090' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'workstation',id FROM tags WHERE namespace='tag' AND name='workstation' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'workstation',id FROM tags WHERE namespace='tag' AND name='cuda' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'workstation',id FROM tags WHERE namespace='class' AND name='Workstation · Off-board Brain' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('pi5','compute') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'pi5',id FROM tags WHERE namespace='tag' AND name='pi' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'pi5',id FROM tags WHERE namespace='tag' AND name='sbc' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'pi5',id FROM tags WHERE namespace='tag' AND name='spare' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'pi5',id FROM tags WHERE namespace='class' AND name='SBC · Onboard I/O' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('orin-nano','compute') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='tag' AND name='ampere' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='tag' AND name='edge-ai' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='tag' AND name='cutover' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'orin-nano',id FROM tags WHERE namespace='class' AND name='Edge AI Module' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('jetson-thor','compute') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'jetson-thor',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'jetson-thor',id FROM tags WHERE namespace='tag' AND name='thor' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'jetson-thor',id FROM tags WHERE namespace='tag' AND name='blackwell' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'jetson-thor',id FROM tags WHERE namespace='tag' AND name='industrial' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'jetson-thor',id FROM tags WHERE namespace='class' AND name='Edge AI — Industrial Tier' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('udm-pro-max','network') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'udm-pro-max',id FROM tags WHERE namespace='tag' AND name='unifi' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'udm-pro-max',id FROM tags WHERE namespace='tag' AND name='gateway' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'udm-pro-max',id FROM tags WHERE namespace='tag' AND name='homelab' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'udm-pro-max',id FROM tags WHERE namespace='class' AND name='Gateway · Controller' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('unifi-aps','network') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-aps',id FROM tags WHERE namespace='tag' AND name='unifi' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-aps',id FROM tags WHERE namespace='tag' AND name='wifi' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-aps',id FROM tags WHERE namespace='tag' AND name='coverage' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-aps',id FROM tags WHERE namespace='class' AND name='Access Points' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('unifi-cams','network') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-cams',id FROM tags WHERE namespace='tag' AND name='unifi' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-cams',id FROM tags WHERE namespace='tag' AND name='camera' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-cams',id FROM tags WHERE namespace='tag' AND name='ptz' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'unifi-cams',id FROM tags WHERE namespace='class' AND name='Surveillance' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('home-assistant','home') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'home-assistant',id FROM tags WHERE namespace='tag' AND name='home-assistant' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'home-assistant',id FROM tags WHERE namespace='tag' AND name='thread' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'home-assistant',id FROM tags WHERE namespace='tag' AND name='automation' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'home-assistant',id FROM tags WHERE namespace='class' AND name='Automation Hub' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('rog-kithara','audio') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rog-kithara',id FROM tags WHERE namespace='tag' AND name='audio' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rog-kithara',id FROM tags WHERE namespace='tag' AND name='headset' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rog-kithara',id FROM tags WHERE namespace='tag' AND name='planar' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'rog-kithara',id FROM tags WHERE namespace='class' AND name='Open-back Planar Headset' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('glinet-comet-q-gl-rmq1','network') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='tag' AND name='kvm' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='tag' AND name='usb-c' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='tag' AND name='wifi-6' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='tag' AND name='glinet' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='tag' AND name='kickstarter' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-q-gl-rmq1',id FROM tags WHERE namespace='category' AND name='Remote KVM' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('glinet-comet-x-gl-rm4pe','network') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='kvm' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='rack' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='poe' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='homelab' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='glinet' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='tag' AND name='kickstarter' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'glinet-comet-x-gl-rm4pe',id FROM tags WHERE namespace='category' AND name='Rack KVM' ON CONFLICT DO NOTHING;
INSERT INTO asset_groups(asset_id,group_id) VALUES ('lafaer-lwr02-presence-sensor','home') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='matter' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='thread' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='presence' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='mmwave' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='pir' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='home-assistant' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='tag' AND name='kickstarter' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'lafaer-lwr02-presence-sensor',id FROM tags WHERE namespace='category' AND name='Presence Sensor' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'light-bar',id FROM tags WHERE namespace='category' AND name='Lighting' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'crawler-led-kit',id FROM tags WHERE namespace='category' AND name='Lighting' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'depth-cam',id FROM tags WHERE namespace='category' AND name='Sensing' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'standalone-lidar',id FROM tags WHERE namespace='category' AND name='Sensing' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'audeze-mm100',id FROM tags WHERE namespace='category' AND name='Audio' ON CONFLICT DO NOTHING;

-- hotspots + sockets
INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES ('beast','lighting','Top Deck / Sensor Mast',30,19);
INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES ('beast','compute','Host Controller Board',50,54);
INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES ('beast','power','Undercarriage Bay',50,79);
INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES ('beast','arm','Manipulator Arm Base',64,40);
INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES ('beast','driver','Driver Board I/O',40,48);
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Chassis Mounts','Host Controller Mount',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='compute'),'Fitted and network-verified 2026-07-28; one side of the mounting struts is still missing');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Chassis Mounts','21mm Picatinny Rail',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='lighting'),'OAK-D Lite from the ACCE ROS2 kit');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Chassis Mounts','Middle Deck',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='compute'),'D500 360° LiDAR from the ACCE ROS2 kit');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Chassis Mounts','1020 Aluminum Rails',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='power'),'Sides. Accepts T-slot nuts for batteries, arms, brackets');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Chassis Mounts','Undercarriage Bay',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='power'),'Holds 3x 18650 UPS. Fits 3S LiPo packs');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','XH2.54 Battery Input',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='power'),'Wire in larger external 3S packs to bypass UPS');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','Aux Interface (IO4/5)',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'High-current MOSFET switched for LEDs or payloads');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','Serial Bus Servo',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='arm'),'Stock ST3215 pan-tilt uses the servo bus; no manipulator arm is installed');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','PWM Output Pins',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'Drives standard hobby servos or external motor controllers');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','40-Pin GPIO Header',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'Re-exposes unused Pi/Jetson pins for external HATs');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','USB HUB / Type-C',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='compute'),'Accepts 4G/5G modems, receivers, or host-slave bypass');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','Audio Expansion',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'3.5mm AUX, dual speaker/mic headers for TTS/spatial audio');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','LiDAR UART Port',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'D500/STL-19P UART routed to the host over USB');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','TF (MicroSD) Slot',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'Standalone data logging directly to ESP32 sub-controller');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','Display Header',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'Drives 0.91"/0.96" OLED for voltage/IP telemetry');
INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES ('beast','Driver Board Interfaces','Power Output Pins',(SELECT id FROM hotspots WHERE host_asset_id='beast' AND code='driver'),'Raw 5V/3.3V out for independent MCUs or sensors');

-- interface_types + socket_accepts + asset_interfaces (loadout candidacy demo)
INSERT INTO interface_types(id,name,kind,note) VALUES ('host-mount','Host Controller Mount','mechanical','SBC/edge host carrier mount');
INSERT INTO interface_types(id,name,kind,note) VALUES ('serial-bus-servo','Serial Bus Servo','data','ST3215/ST3235 daisy-chain');
INSERT INTO interface_types(id,name,kind,note) VALUES ('ups-bay','Undercarriage UPS Bay','power','3x18650 / 3S pack bay');
INSERT INTO interface_types(id,name,kind,note) VALUES ('i2c-display','I²C Display Header','data','0.91/0.96in OLED');
INSERT INTO interface_types(id,name,kind,note) VALUES ('sensor-rail','Sensor Rail Mount','mechanical','Top-deck accessory rail');
INSERT INTO interface_types(id,name,kind,note) VALUES ('sensor-deck','Sensor Deck Mount','mechanical','Middle-deck sensor plate');
INSERT INTO interface_types(id,name,kind,note) VALUES ('lidar-uart','LiDAR UART','data','LiDAR UART routed to host USB');
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'host-mount' FROM sockets WHERE host_asset_id='beast' AND name='Host Controller Mount' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'serial-bus-servo' FROM sockets WHERE host_asset_id='beast' AND name='Serial Bus Servo' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'ups-bay' FROM sockets WHERE host_asset_id='beast' AND name='Undercarriage Bay' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'i2c-display' FROM sockets WHERE host_asset_id='beast' AND name='Display Header' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'sensor-rail' FROM sockets WHERE host_asset_id='beast' AND name='21mm Picatinny Rail' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'sensor-deck' FROM sockets WHERE host_asset_id='beast' AND name='Middle Deck' ON CONFLICT DO NOTHING;
INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,'lidar-uart' FROM sockets WHERE host_asset_id='beast' AND name='LiDAR UART Port' ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('pi5','host-mount') ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('orin-nano','host-mount') ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('stock-ups','ups-bay') ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('oak-d-lite','sensor-rail') ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('d500-lidar','sensor-deck') ON CONFLICT DO NOTHING;
INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES ('d500-lidar','lidar-uart') ON CONFLICT DO NOTHING;

-- loadout_assignments
INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,'orin-nano','host-mount' FROM sockets WHERE host_asset_id='beast' AND name='Host Controller Mount' ON CONFLICT DO NOTHING;
INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,'oak-d-lite','sensor-rail' FROM sockets WHERE host_asset_id='beast' AND name='21mm Picatinny Rail' ON CONFLICT DO NOTHING;
INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,'d500-lidar','sensor-deck' FROM sockets WHERE host_asset_id='beast' AND name='Middle Deck' ON CONFLICT DO NOTHING;
INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,'stock-ups','ups-bay' FROM sockets WHERE host_asset_id='beast' AND name='Undercarriage Bay' ON CONFLICT DO NOTHING;
INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,'d500-lidar','lidar-uart' FROM sockets WHERE host_asset_id='beast' AND name='LiDAR UART Port' ON CONFLICT DO NOTHING;

-- missions + requisitions + objectives + constraints
INSERT INTO missions(id,code,name,status,objective,environment,required_loadout) VALUES ('undercroft','MSN-01','Mission: Undercroft','planning','Haul Cat6 cable ends through the crawlspace by remote-piloting the Beast.','Large crawlspace — walkable semi-crouched. Open but for support pillars, pipes, and ductwork (the Beast generally passes under). Low light. Dusty.',ARRAY['Lighting (offset flood)','Off-board compute link (WiFi 6)','Stale-command watchdog']::text[]);
INSERT INTO mission_requisitions(mission_id,asset_id) VALUES ('undercroft','beast') ON CONFLICT DO NOTHING;
INSERT INTO mission_requisitions(mission_id,asset_id) VALUES ('undercroft','workstation') ON CONFLICT DO NOTHING;
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('undercroft','Fit offset flood lighting (not lens-adjacent)',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('undercroft','Verify WiFi 6 coverage under the house',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('undercroft','Add cmd_vel timeout / firmware heartbeat — stale-command stop FAILED 2026-07-31',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('undercroft','Dry-run teleop path around pillars + ductwork (allow_motion only with live stop path)',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('undercroft','Execute cable haul',false);
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('undercroft','Onboard Power',22,25,'W');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('undercroft','Payload',380,500,'g');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('undercroft','Loadout Cost',35,120,'$');
INSERT INTO mission_after_actions(mission_id,position,text) VALUES ('undercroft',0,'2026-07-01 OP-BEAST-CONTACT: Pi web UI, JupyterLab, Socket.IO command channel, and telemetry verified at 192.168.20.184. beast.local did not resolve from icarus-laptop; use the fixed IP until DNS/mDNS is repaired. Sent zero-speed stop only; no drive nudge performed.') ON CONFLICT DO NOTHING;
INSERT INTO mission_after_actions(mission_id,position,text) VALUES ('undercroft',1,'2026-07-22 OP-ORIN-GAP: Raspberry Pi 5 removed; host mount empty mid Orin Nano cutover. No upper-computer teleop until Jetson is fitted. Operator notes Beast is slow and hard-stopping — remote + on-device control are both viable after host restore.') ON CONFLICT DO NOTHING;
INSERT INTO mission_after_actions(mission_id,position,text) VALUES ('undercroft',2,'2026-07-28 OP-ORIN-POWER: Jetson Orin Nano Super fitted and network-verified by live SSH (hostname beast-01, LAN/Wi-Fi/Tailscale all up), powered via the UPS board''s factory barrel-jack pigtail rather than the driver board''s back-feeding USB-C.') ON CONFLICT DO NOTHING;
INSERT INTO mission_after_actions(mission_id,position,text) VALUES ('undercroft',3,'2026-07-30 OP-BEAST-NET: Robot VLAN 192.168.20.x rejected for Orin — stay on general LAN 192.168.0.x + Tailscale. Pi Control UI URLs retired from Hangar shortcuts. Live ROS base confirmed (USB serial ESP32+LiDAR; GPIO UART jumper plan superseded).') ON CONFLICT DO NOTHING;
INSERT INTO mission_after_actions(mission_id,position,text) VALUES ('undercroft',4,'2026-07-31 OP-BEAST-HB: Heartbeat-stop test FAILED — ESP32 latched last /cmd_vel for minutes after publisher death. Motion re-locked (allow_motion:=false). Do not unlock without a cmd_vel-timeout watchdog.') ON CONFLICT DO NOTHING;
INSERT INTO missions(id,code,name,status,objective,environment,required_loadout) VALUES ('perimeter-mapping','MSN-02','Perimeter Mapping','standby','Build a fused map of the property perimeter for future autonomy.','Outdoor, variable light, longer range.',ARRAY['Depth/LiDAR sensing','Calibration','Off-board mapping']::text[]);
INSERT INTO mission_requisitions(mission_id,asset_id) VALUES ('perimeter-mapping','beast') ON CONFLICT DO NOTHING;
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('perimeter-mapping','Select sensing path (depth cam vs LiDAR)',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('perimeter-mapping','Solve calibration + time-sync burden',false);
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('perimeter-mapping','Onboard Power',0,25,'W');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('perimeter-mapping','Payload',0,500,'g');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('perimeter-mapping','Loadout Cost',0,600,'$');
INSERT INTO missions(id,code,name,status,objective,environment,required_loadout) VALUES ('pool-deck-patrol','MSN-03','Pool Deck Patrol','standby','Map safe, supervised rover lanes around the pool deck before any patrol or automation loop is trusted near water.',NULL,ARRAY['Pool-edge standoff markers','Low-speed teleop profile','Outdoor camera coverage']::text[]);
INSERT INTO mission_requisitions(mission_id,asset_id) VALUES ('pool-deck-patrol','beast') ON CONFLICT DO NOTHING;
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('pool-deck-patrol','Mark pool-edge exclusion zones and patio pinch points',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('pool-deck-patrol','Verify low-speed teleop path with manual stop coverage',false);
INSERT INTO mission_objectives(mission_id,text,done) VALUES ('pool-deck-patrol','Capture deck lighting, glare, and WiFi notes for camera placement',false);
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('pool-deck-patrol','Onboard Power',0,25,'W');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('pool-deck-patrol','Payload',0,500,'g');
INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES ('pool-deck-patrol','Loadout Cost',0,300,'$');

-- capabilities + deps + asset_capabilities
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('teleop','Remote Teleoperation','FPV remote piloting with onboard I/O on the Jetson Orin host and PID on the ESP32. Host is fitted and network-verified (2026-07-28); offline until the ESP32 UART jumper link is wired and the control software stack is confirmed on the Orin.',false,'robotics');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('night-ops','Low-Light / Night Ops','Offset flood lighting enables piloting in dark, dusty spaces without backscatter washout.',false,'robotics');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('crawlspace-ops','Crawlspace Operations','Navigate under pillars, pipes, and ductwork in tight, low-clearance environments.',true,'robotics');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('gpu-offload','Off-board GPU Offload','Stream observations to the 5090 over WiFi 6; receive actions/perception back. On BEAST, remote closed-loop is first-class alongside on-device Orin inference.',true,'compute');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('policy-training','Policy Training','Train / fine-tune learned policies off-board on the 5090, deploy to the edge.',true,'compute');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('onboard-autonomy','Dropout-Proof Onboard Autonomy','In-motion autonomy that survives a WiFi dropout — needs a CUDA brain on the rover (Orin).',false,'robotics');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('rgbd-perception','Fused RGB-D Perception','Registered colour + depth out of the box, zero calibration burden.',false,'robotics');
INSERT INTO capabilities(id,name,description,unlocked,bay) VALUES ('long-range-mapping','Long-Range Mapping','Standalone LiDAR geometry at range — gated behind calibration + time-sync work.',false,'robotics');
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('beast','teleop') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('orin-nano','teleop') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('light-bar','night-ops') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('beast','crawlspace-ops') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('workstation','gpu-offload') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('udm-pro-max','gpu-offload') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('unifi-aps','gpu-offload') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('workstation','policy-training') ON CONFLICT DO NOTHING;
INSERT INTO capability_deps(capability_id,depends_on_id) VALUES ('onboard-autonomy','gpu-offload') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('orin-nano','onboard-autonomy') ON CONFLICT DO NOTHING;
INSERT INTO capability_deps(capability_id,depends_on_id) VALUES ('rgbd-perception','teleop') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('depth-cam','rgbd-perception') ON CONFLICT DO NOTHING;
INSERT INTO capability_deps(capability_id,depends_on_id) VALUES ('long-range-mapping','teleop') ON CONFLICT DO NOTHING;
INSERT INTO asset_capabilities(asset_id,capability_id) VALUES ('standalone-lidar','long-range-mapping') ON CONFLICT DO NOTHING;

-- wishlist_meta
INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id,source) VALUES ('light-bar','wishlist','Wide flood, rugged, 2S–3S input — runs off the battery rail, not the Pi. Mount forward + angled down ~15–20° to light the floor without blasting dust at lens level.','night-ops','Import variants vary in driver quality; verify 3S rating.','beast','undercroft','Pro-Line / generic crawler bars');
INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id,source) VALUES ('crawler-led-kit','wishlist','Cheapest path — multiple small LEDs you can place and offset individually off the lens axis.','night-ops',NULL,'beast','undercroft',NULL);
INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id,source) VALUES ('depth-cam','wishlist','Factory-calibrated RGB-D on one USB stream — erases camera intrinsics, extrinsics, and time-sync work. Computes depth onboard, so the host streams it without a GPU. The "reach high but solve power" first step.','rgbd-perception','Compromises max range vs standalone LiDAR.','beast','perimeter-mapping',NULL);
INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id,source) VALUES ('standalone-lidar','wishlist','Mind-blowing range/coverage but LiDAR-only. Adds extrinsic calibration + time-sync burden, and more total draw — compounds the Pi power problem. Defer until the pipeline exists.','long-range-mapping','Calibration + time-sync + power burden; drifts with vibration on a tracked base.','beast',NULL,NULL);
INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id,source) VALUES ('audeze-mm100','wishlist','Top of the Audio Lab planar wishlist.',NULL,NULL,'rog-kithara',NULL,NULL);

-- insights + junctions
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('usb-backfeeds-the-stack','The ESP32 USB cable powers the whole robot, not just its logic','On the ROS driver board the Type-C VBUS lands on net "5V" through Schottky D2 — the same net as both 40-pin headers, the LiDAR header and the AMS1117 input. So plugging the host into the ESP32 port energises the entire stack: HAT, codec, amp, fan and LiDAR motor, all through one USB connector, even with the chassis switch off. Confirmed on the bench by a D500 spinning with the pack dead. The board is designed to power the host, so it assumes the pack is on; running host-on/pack-off is not a supported state. Full trace in docs/beast-ops.md — OP-BEAST-BACKFEED.','high','docs/beast-ops.md — OP-BEAST-BACKFEED','2026-07-27','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('usb-backfeeds-the-stack','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'usb-backfeeds-the-stack',id FROM tags WHERE namespace='tag' AND name='power' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'usb-backfeeds-the-stack',id FROM tags WHERE namespace='tag' AND name='usb' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'usb-backfeeds-the-stack',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'usb-backfeeds-the-stack',id FROM tags WHERE namespace='tag' AND name='gotcha' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('read-the-netlist-not-the-summary','Derived diagrams drift; go back to the netlist','A day of wrong diagnoses came from reasoning off a summarised power tree that said host VBUS reached only the 3V3 regulator. The schematic PDF''s embedded netlist said otherwise in one line, and Waveshare''s own product page — already sitting in keyArtifactstosort — answered the architecture question outright. When a hardware symptom contradicts the model, re-read the primary source before building a theory on the model. Vendor primaries are archived under keyArtifactstosort/reference/ with an INDEX noting what each answers.','high','keyArtifactstosort/reference/INDEX.md','2026-07-27','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('read-the-netlist-not-the-summary','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'read-the-netlist-not-the-summary',id FROM tags WHERE namespace='tag' AND name='method' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'read-the-netlist-not-the-summary',id FROM tags WHERE namespace='tag' AND name='documentation' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'read-the-netlist-not-the-summary',id FROM tags WHERE namespace='tag' AND name='debugging' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('dust-backscatter','Offset lights from the camera lens','In a dusty crawlspace, a light next to the lens illuminates floating dust between camera and target — driving in glowing fog. Mount low/forward, angled down, or off to the side; favour wide flood over spot to avoid hot centres and glare off galvanized duct.','high',NULL,'2026-05-31','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('dust-backscatter','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('dust-backscatter','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'dust-backscatter',id FROM tags WHERE namespace='tag' AND name='lighting' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'dust-backscatter',id FROM tags WHERE namespace='tag' AND name='fpv' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'dust-backscatter',id FROM tags WHERE namespace='tag' AND name='crawlspace' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('power-rail','Power lights off the battery rail, not the Pi','RC crawler lights are rated 2S–3S, so they run straight off the ~11.1V pack through the driver board — drawing nothing from the constrained 5V/5A Pi rail. The elegant option is also the power-friendly one.','high',NULL,'2026-05-31','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('power-rail','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('power-rail','pi5') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('power-rail','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'power-rail',id FROM tags WHERE namespace='tag' AND name='power' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'power-rail',id FROM tags WHERE namespace='tag' AND name='lighting' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('watchdog','Stale-command watchdog beats latency worries','The risk on WiFi is the tail, not the median. A cheap onboard reflex — "no fresh command in N ms → stop or coast" — turns a dropped packet into a brief pause instead of a crash. Lives on the Pi/ESP32, never depends on the link.','high',NULL,'2026-05-31','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('watchdog','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('watchdog','pi5') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('watchdog','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'watchdog',id FROM tags WHERE namespace='tag' AND name='safety' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'watchdog',id FROM tags WHERE namespace='tag' AND name='offload' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'watchdog',id FROM tags WHERE namespace='tag' AND name='control' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('wifi-tail','WiFi 6 median is great; the tail is the enemy','Local 5GHz / WiFi 6 gives 2–10 ms round trips, low-tens under contention — fine even for tight loops. The danger is the occasional 200 ms stall or half-second gap from roaming, contention, or noise. Design for the worst packet in the window.','high',NULL,'2026-05-31','network');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('wifi-tail','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('wifi-tail','unifi-aps') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'wifi-tail',id FROM tags WHERE namespace='tag' AND name='network' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'wifi-tail',id FROM tags WHERE namespace='tag' AND name='latency' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'wifi-tail',id FROM tags WHERE namespace='tag' AND name='offload' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('video-device-path','Camera device paths can move after reboot','BEAST-01 video failed when the USB camera re-enumerated and Waveshare code kept opening hardcoded camera index 0. Use the stable /dev/v4l/by-id video-index0 path, or scan /dev/video* for the first readable capture device, then restart only the Flask app.','high',NULL,'2026-06-30','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('video-device-path','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('video-device-path','pi5') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('video-device-path','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'video-device-path',id FROM tags WHERE namespace='tag' AND name='fpv' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'video-device-path',id FROM tags WHERE namespace='tag' AND name='camera' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'video-device-path',id FROM tags WHERE namespace='tag' AND name='operations' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('beast-socket-control','Pi-era Socket.IO control (historical)','On 2026-07-01 (Pi upper computer), BEAST-01 answered at 192.168.20.184 with the Waveshare web UI, JupyterLab, Socket.IO /json control, and /ctrl telemetry. That Pi identity and Control UI are retired. As of 2026-07-30 the Orin runs ROS 2 teleop over SSH (no web dashboard on any port). beast:probe still targets a Waveshare-style web UI and requires an explicit --host / BEAST_HOST — do not assume the old Pi URL.','high','Live BEAST-01 probe from icarus-laptop; updated 2026-07-30 against Orin ROS ground truth','2026-07-01','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-socket-control','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-socket-control','pi5') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('beast-socket-control','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-socket-control',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-socket-control',id FROM tags WHERE namespace='tag' AND name='control' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-socket-control',id FROM tags WHERE namespace='tag' AND name='telemetry' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-socket-control',id FROM tags WHERE namespace='tag' AND name='network' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-socket-control',id FROM tags WHERE namespace='tag' AND name='historical' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('offload-split','Train heavy offboard; run Beast control where it fits','CORE-PRIME is still the training / heavy-VLM box. On BEAST, operator override 2026-07-22: remote closed-loop and lightweight on-device inference (terrain alignment, obstacle avoidance) are both fine — the rover is slow and stops in time. Keep motor PID + stale-command watchdog as hard fail-safes. Rejected: treating avoidance or visual steering as forbidden over WiFi or “too late to stop.”','high','Operator correction 2026-07-22','2026-07-22','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('offload-split','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('offload-split','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('offload-split','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'offload-split',id FROM tags WHERE namespace='tag' AND name='architecture' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'offload-split',id FROM tags WHERE namespace='tag' AND name='offload' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'offload-split',id FROM tags WHERE namespace='tag' AND name='autonomy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'offload-split',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('depth-onboard','Integrated depth cameras compute depth onboard','An integrated RGB-D camera ships factory-calibrated and computes depth on-device, so the Pi can stream fused RGB-D without a GPU — erasing intrinsics, extrinsics, and time-sync from the to-do list.','high',NULL,'2026-05-31','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('depth-onboard','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('depth-onboard','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'depth-onboard',id FROM tags WHERE namespace='tag' AND name='sensing' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'depth-onboard',id FROM tags WHERE namespace='tag' AND name='calibration' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('calibration-burden','Separate camera + LiDAR = real calibration burden','You produce a 6-DOF rigid transform plus time sync. Sleeper problems: time sync (independent clocks smear points in motion) and drift (vibration + thermal cycling walk the extrinsic off true — worse on a tracked base). Standalone LiDAR also adds power draw.','high','koide3/direct_visual_lidar_calibration','2026-05-31','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('calibration-burden','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('calibration-burden','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'calibration-burden',id FROM tags WHERE namespace='tag' AND name='sensing' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'calibration-burden',id FROM tags WHERE namespace='tag' AND name='calibration' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'calibration-burden',id FROM tags WHERE namespace='tag' AND name='lidar' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('orin-tier','Orin Nano is the stable mainstream entry tier','NVIDIA gave Orin the free "Super" boost and extended its lifecycle through 2032. Buying an Orin Nano Super now is not buying into something about to be discontinued — it is the mainstream tier for years.','high',NULL,'2026-05-31','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-tier','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-tier',id FROM tags WHERE namespace='tag' AND name='compute' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-tier',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('blackwell-gap','No Blackwell Nano exists — yet','Blackwell in Jetson is top-end only (Thor T4000/T5000). The Nano/NX tiers are still Ampere. The genuinely Blackwell option you already own is the 5090 — which is exactly why offload-over-WiFi is worth taking seriously.','high',NULL,'2026-05-31','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('blackwell-gap','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('blackwell-gap','jetson-thor') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('blackwell-gap','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'blackwell-gap',id FROM tags WHERE namespace='tag' AND name='compute' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'blackwell-gap',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'blackwell-gap',id FROM tags WHERE namespace='tag' AND name='blackwell' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('thor-tier','Thor is industrial-tier, wrong size for a rover','Thor (T4000/T5000) targets humanoids and warehouse AMRs that must run large VLA models fully onboard with the power budget to carry a 40–130 W brain. A tracked hobby rover within AP range is not that animal.','high',NULL,'2026-05-31','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('thor-tier','jetson-thor') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'thor-tier',id FROM tags WHERE namespace='tag' AND name='compute' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'thor-tier',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'thor-tier',id FROM tags WHERE namespace='tag' AND name='tiering' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('lerobot-optional','LeRobot is an option, not the platform','LeRobot is software you would deliberately install for learned manipulation (ACT, SmolVLA, π0) — not hardware branding you already own. It only matters if the goal becomes the arm learning from demonstrations, versus classical CV + teleop.','medium',NULL,'2026-05-31','robotics');
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'lerobot-optional',id FROM tags WHERE namespace='tag' AND name='software' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'lerobot-optional',id FROM tags WHERE namespace='tag' AND name='policy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'lerobot-optional',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('robot-llm-lanes','Robot-control LLMs are three lanes, not one buy','Split the space: (A) language orchestrators → goals, (B) VLA/imitation closed-loop drive, (C) world action models (Cosmos 3 Edge). Autonomy in scope (G7). On Beast: remote closed-loop, on-device lightweight terrain alignment/avoidance, and heavier Orin/5090 policies are all fine — it stops in time. Keep PID/watchdog; reject stop-in-time and “avoidance forbidden” refusals. Post-train for tracks, not stock DROID arms.','high','/datacore/briefing/robot-control-llms','2026-07-22','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('robot-llm-lanes','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('robot-llm-lanes','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('robot-llm-lanes','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('robot-llm-lanes','jetson-thor') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('robot-llm-lanes','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='llm' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='vla' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='cosmos' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='policy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='architecture' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'robot-llm-lanes',id FROM tags WHERE namespace='tag' AND name='autonomy' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('beast-llm-jobs','On BEAST, the LLM path ends in self-driving missions','Build order once Orin is in: (1) phrase driving; (2) gimbal aim; (3) scene coach; (4) lightweight onboard terrain alignment / obstacle avoidance; (5) autonomous Undercroft cable-haul; (6) closed-loop crawl/patrol via LeRobot / Cosmos post-train — remote or on-device. Remote control is first-class. Not jobs: stock DROID arm policies on tracks, or replacing the watchdog/PID.','high','/datacore/briefing/robot-control-llms','2026-07-22','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-llm-jobs','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-llm-jobs','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-llm-jobs','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('beast-llm-jobs','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='llm' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='teleop' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='undercroft' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='autonomy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-llm-jobs',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('ag2-repealed','Autonomy ban repealed — Hangar may self-drive units','2026-07-22: North Star AG2 (“not an autonomous system / human always in the loop”) is removed. New G7: Hangar hosts a live command portal including teleop and autonomous/learned policies. Onboard fail-safes remain mandatory engineering, not a product veto on closed-loop control.','high','docs/NORTH_STAR.md','2026-07-22','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('ag2-repealed','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ag2-repealed',id FROM tags WHERE namespace='tag' AND name='north-star' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ag2-repealed',id FROM tags WHERE namespace='tag' AND name='autonomy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ag2-repealed',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('beast-slow-hard-stop','Beast stops in time — lightweight onboard avoidance is fine','Operator correction 2026-07-22: BEAST-01 crawls slowly, hard-stops, and absolutely can stop in time for terrain/obstacle reactions. Remote closed-loop from CORE-PRIME is fine. Lightweight on-device Orin inference for terrain alignment and avoidance is fine — lots of tricks available, not a research fantasy. Rejected conclusions: “won’t stop in time,” “avoidance must stay classical-only,” “WiFi/visual steering too dangerous on this chassis.” Keep PID + watchdog; do not invent more refusals.','high','Operator correction during Orin cutover','2026-07-22','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-slow-hard-stop','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-slow-hard-stop','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('beast-slow-hard-stop','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('beast-slow-hard-stop','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='control' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='latency' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='autonomy' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='perception' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'beast-slow-hard-stop',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('orin-host-gap','Pi-out gap (superseded) — Orin now fitted','Historical 2026-07-22: Raspberry Pi 5 removed; host mount empty while Orin was being fitted. SUPERSEDED 2026-07-28 by orin-barrel-jack-power — Orin Nano Super is physically fitted, pack-powered via the UPS barrel pigtail, and SSH-verified on LAN 192.168.0.x + Tailscale. Remaining blocker is ESP32 UART jumpers (pins 8/10 + GND) and mounting strut, not “no upper computer.” Robot VLAN 192.168.20.x is rejected — stay on general LAN + Tailscale.','high','Superseded by live SSH 2026-07-28; operator network decision 2026-07-30','2026-07-22','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-host-gap','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-host-gap','pi5') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-host-gap',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-host-gap',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-host-gap',id FROM tags WHERE namespace='tag' AND name='cutover' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-host-gap',id FROM tags WHERE namespace='tag' AND name='operations' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-host-gap',id FROM tags WHERE namespace='tag' AND name='historical' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('orin-barrel-jack-power','The UPS board''s "spare" barrel pigtail was the factory Jetson power lead','A 4th connector on the UPS Module 3S — assumed to be a bare XH2.54 socket — turned out to be a barrel-jack pigtail already wired into the board, unused because the original build ran a Pi 5. Verified before trusting it: sleeve/center multimeter test read center pin positive relative to sleeve at 11.5V (matches the Orin J16 spec — center-positive, 9-20V range), then an unpowered dry-fit into the Orin''s DC jack seated flush with no wobble (2.5mm pin, not the generic 2.1mm DC5521). Connected and the Jetson booted clean, confirmed live over SSH: hostname beast-01, JetPack R36.5.0 (R36 REVISION 5.0), simultaneously reachable on LAN (192.168.0.166), Wi-Fi (192.168.0.251), and Tailscale (100.107.16.72). This is the practical resolution to OP-BEAST-BACKFEED: power the Orin from this pack-fed barrel lead, never from the driver board''s USB-C — no board rework needed, the fix was using the connector the vendor already ran.','high','Live multimeter check + SSH boot verification, 2026-07-28','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-barrel-jack-power','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-barrel-jack-power','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('orin-barrel-jack-power','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-barrel-jack-power',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-barrel-jack-power',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-barrel-jack-power',id FROM tags WHERE namespace='tag' AND name='power' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-barrel-jack-power',id FROM tags WHERE namespace='tag' AND name='cutover' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-barrel-jack-power',id FROM tags WHERE namespace='tag' AND name='gotcha' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('orin-edge-model-shortlist','Orin Nano shortlist: SmolVLA first, then GR00T / small VLMs','On Orin Nano 8GB (~7.6 GB usable): SmolVLA (~450M) is the first closed-loop VLA that fits with headroom; GR00T N1.x (~3B FP16) also fits. For scene/phrase work: InternVL3 or Qwen*-VL 2B-class + Qwen3-4B/Nemotron-Nano-4B INT4. Cosmos 3 Edge is interesting as an open world-action + post-train path (5090 gym; Thor-quoted 15 Hz; Cosmos Reason ~2B called out for Orin 8GB) — not as a Thor purchase trigger. Pi0/OpenVLA stay on CORE-PRIME unless distilled.','high','/datacore/briefing/robot-control-llms','2026-07-22','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-edge-model-shortlist','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-edge-model-shortlist','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('orin-edge-model-shortlist','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('orin-edge-model-shortlist','undercroft') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='vla' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='llm' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='cosmos' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='edge' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'orin-edge-model-shortlist',id FROM tags WHERE namespace='tag' AND name='decision' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('compute-sizing-method','Jetson tier fit needs linked workload views, not TOPS','Orin Nano / NX / AGX decisions are proven with concurrent pipelines: requirements → functional dataflow → cyber-physical allocation → interface/timing → engine matrix → full-graph measurements. Camera ingress, ISP, memory, encode, and sync often dominate over advertised TOPS. Full brief in Datacore.','high','/datacore/briefing/compute-workload','2026-07-23','compute');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('compute-sizing-method','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('compute-sizing-method','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('compute-sizing-method','workstation') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'compute-sizing-method',id FROM tags WHERE namespace='tag' AND name='compute' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'compute-sizing-method',id FROM tags WHERE namespace='tag' AND name='jetson' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'compute-sizing-method',id FROM tags WHERE namespace='tag' AND name='orin' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'compute-sizing-method',id FROM tags WHERE namespace='tag' AND name='sizing' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'compute-sizing-method',id FROM tags WHERE namespace='tag' AND name='architecture' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('ghcr-buildrun-noise','Diagnose GHCR from live BuildRuns, not stale failures','On 2026-07-01 the live ExternalSecret-backed GHCR push and pull secrets were synced and shaped correctly, and current Shipwright BuildRuns pushed immutable image digests. Old failed BuildRuns were Dockerfile path mistakes and cleanup noise, not evidence that the GHCR tokens were broken.','high','coldaine-k8cluster live kubectl inspection','2026-07-01','compute');
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ghcr-buildrun-noise',id FROM tags WHERE namespace='tag' AND name='deployment' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ghcr-buildrun-noise',id FROM tags WHERE namespace='tag' AND name='shipwright' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ghcr-buildrun-noise',id FROM tags WHERE namespace='tag' AND name='ghcr' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'ghcr-buildrun-noise',id FROM tags WHERE namespace='tag' AND name='kubernetes' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('rnd-splat-arch-b','Build A capture: images carry poses, LiDAR supplies geometry','Research (non-definitive): for offline Gaussian splatting, Architecture B wins — park the rover, stop-and-shoot, recover poses from the images (COLMAP/SfM), and use LiDAR for dense init / depth supervision. Sub-ms time sync, rigid cam-to-LiDAR mount, and hardware trigger are not load-bearing for this capture path. Full brief in Datacore.','medium','/datacore/briefing/beast-splat-architecture','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-splat-arch-b','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('rnd-splat-arch-b','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='vision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='research' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='splat' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='architecture' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='gaussian' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='colmap' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-splat-arch-b',id FROM tags WHERE namespace='tag' AND name='3dgs' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('rnd-servo-cam-b0497','Servo-head research candidate: Arducam B0497 IMX678','Research (not purchased): Arducam B0497 (8.3MP STARVIS 2 IMX678, UVC USB3, ~$160) is the current pan-tilt head candidate under Architecture B. Three flags before any buy: stock focus is 3m–∞ (budget a closer M12 lens for indoors), integral IR-cut (visible only), 4K at 15fps only. Fixed chassis slot stays the owned OAK-D Lite.','medium','/datacore/briefing/beast-servo-camera','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-servo-cam-b0497','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-servo-cam-b0497','oak-d-lite') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('rnd-servo-cam-b0497','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='vision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='research' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='camera' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='arducam' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='b0497' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='imx678' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-servo-cam-b0497',id FROM tags WHERE namespace='tag' AND name='starvis' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('rnd-vision-rejected','Zoom, thermal, FPV, and PTZ paths are research-killed','Research kill list for the current premise: DJI/Walksnail FPV chains, Insta360 X5, IP PTZ security cams, FLIR Lepton / InfiRay thermal, motorized optical zoom, and machine-vision trigger cameras. Do not re-propose without a new premise — prior console zoom/thermal shortlist is superseded. Full reasons in Datacore.','medium','/datacore/briefing/beast-rejected-paths','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-vision-rejected','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('rnd-vision-rejected','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='vision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='research' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='rejected' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='camera' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='thermal' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='fpv' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='zoom' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-vision-rejected',id FROM tags WHERE namespace='tag' AND name='ptz' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('rnd-lidar-open','Standalone LiDAR upgrade still open: Mid-360S vs Airy','Open research (not a ruling): Livox Mid-360S vs RoboSense Airy 96. Current lean is Mid for software lineage and Orin point-rate budget, but confidence is only medium. Servo-vs-rigid LiDAR mounting is a separate unresolved question for Build B nav SLAM.','medium','/datacore/briefing/beast-lidar-open','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-lidar-open','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-lidar-open','d500-lidar') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('rnd-lidar-open','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='vision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='research' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='lidar' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='livox' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='mid-360' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='robosense' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-lidar-open',id FROM tags WHERE namespace='tag' AND name='airy' ON CONFLICT DO NOTHING;
INSERT INTO insights(id,title,body,confidence,source,captured_at,bay) VALUES ('rnd-calibration-scope','Calibration burden still real for nav — not the Build A blocker','Research nuance on calibration-burden: extrinsic + time-sync still matter for Build B live navigation SLAM. Under Architecture B for Build A offline capture, those requirements dissolve — register the cloud to the finished reconstruction afterward. Do not treat the older high-confidence calibration lesson as false; scope it.','medium','/datacore/briefing/beast-splat-architecture','2026-07-28','robotics');
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('rnd-calibration-scope','beast') ON CONFLICT DO NOTHING;
INSERT INTO insight_missions(insight_id,mission_id) VALUES ('rnd-calibration-scope','perimeter-mapping') ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='vision' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='research' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='calibration' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='lidar' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='extrinsic' ON CONFLICT DO NOTHING;
INSERT INTO insight_tags(insight_id,tag_id) SELECT 'rnd-calibration-scope',id FROM tags WHERE namespace='tag' AND name='time-sync' ON CONFLICT DO NOTHING;
INSERT INTO insight_assets(insight_id,asset_id) VALUES ('wifi-tail','beast') ON CONFLICT DO NOTHING;

-- activity_log
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-rnd-beast-vision','2026-07-28T15:00:00Z','researched','RND-BEAST-VISION: Datacore vision research pack indexed (splat arch, servo cam candidate, rejected paths, open LiDAR).');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-orin-barrel-power','2026-07-28T01:00:00Z','mission','OP-ORIN-POWER: Jetson Orin fitted, powered via the UPS board''s factory barrel-jack lead, booted and network-verified over LAN/Wi-Fi/Tailscale by live SSH.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-beast-backfeed','2026-07-27T09:30:00Z','insight','BEAST power domain: Jetson USB found back-feeding the whole 5V stack through D2 — netlist-verified, vendor specs archived.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-compute-sizing','2026-07-23T10:00:00Z','researched','Datacore: compute-workload sizing brief (NX vs AGX linked views) persisted.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-orin-models','2026-07-22T03:55:00Z','researched','Orin edge shortlist: SmolVLA first; GR00T/small VLMs; Cosmos Edge as WAM post-train path.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-orin-host-gap','2026-07-22T03:45:00Z','mission','OP-ORIN-GAP (historical): Pi removed mid-cutover — superseded 2026-07-28 when Orin fitted + SSH-verified.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-beast-slow','2026-07-22T03:46:00Z','insight','Beast stops in time; lightweight onboard terrain avoidance is in play — drop false refusals.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-ag2-repealed','2026-07-22T03:40:00Z','insight','North Star AG2 autonomy ban repealed; G7 makes closed-loop Beast policies in scope.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-robot-llm-brief','2026-07-22T03:20:00Z','researched','RND-ROBOT-LLM: mapped control-LLM / VLA / Cosmos 3 Edge lanes for BEAST autonomy.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a7','2026-07-01T18:32:19Z','mission','OP-BEAST-CONTACT verified BEAST-01 web, Jupyter, Socket.IO control, and telemetry over 192.168.20.184.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a-video-relock','2026-06-30T22:51:00Z','insight','Restored BEAST-01 FPV stream after USB camera re-enumeration; patched camera path selection.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a6','2026-07-01T14:25:43Z','insight','Shipwright/GHCR live status captured; both repos now have bootstrap tooling entrypoints.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a1','2026-05-31T16:15:00Z','mission','Mission: Undercroft opened — status Planning.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a2','2026-05-31T16:10:00Z','insight','Logged 4 insights on crawlspace lighting + offload.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a3','2026-05-31T15:50:00Z','researched','Jetson tiering mapped: Orin = Ampere, Thor = Blackwell.');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a4','2026-05-31T15:30:00Z','price-drop','Orin Nano Super MSRP confirmed at $249 (street ~$349).');
INSERT INTO activity_log(id,at,kind,text) VALUES ('a5','2026-05-31T15:10:00Z','acquired','BEAST-01 commissioned as flagship unit.');

-- terminals
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-power-in','driver-board','Battery Input','XH2.54','input','DC 7–13V from the UPS rail; feeds motors and the servo bus directly');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-5v-host','driver-board','5V Host Rail','40-pin header','output','MP8759 buck ~5A — powers the Raspberry Pi 5. The Orin cannot use this rail.');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-host-uart','driver-board','Host UART','40-pin header','bidirectional','ESP32 ↔ host JSON command/telemetry link');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-servo-bus','driver-board','ST3215 Serial Bus Servo Port','TTL bus header','bidirectional','ESP32 GPIO18/19 @ 1 Mbps; switch-limited to 5A');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-motor-a','driver-board','Motor Interface A','PH2.0 6P','output','TB6612FNG channel + encoder feedback');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-motor-b','driver-board','Motor Interface B','PH2.0 6P','output','TB6612FNG channel + encoder feedback');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-i2c','driver-board','I²C Peripheral Header','pin header','bidirectional','OLED and I²C sensors, driven by the ESP32');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-usb-esp32','driver-board','Type-C (ESP32 UART)','USB-C','bidirectional','Callout 6, silkscreen "USB" — the LEFT of the two Type-C ports, beside the DC jack. CH343P bridge to ESP32 UART0; host JSON link @ 115200. This is the Jetson connection.');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-lidar-uart','driver-board','LiDAR UART Port','UART + Type-C','bidirectional','Callout 7, silkscreen "LIDAR" — the RIGHT Type-C. A second CH343P routes radar serial to USB. Idle on BEAST-01: the D500 rides the Audio HAT LiDAR socket instead.');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-12v-switched','driver-board','12V Switched Outputs','IO4 / IO5','output','ESP32-switched pack-voltage outputs for LEDs or payloads');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-rail-out','stock-ups','Battery Rail Out','XH2.54','output','3S pack, 9–12.6V @ 2A');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-charge-in','stock-ups','Charge Input','DC5521','input','12.6V / 2A charger; supports charge-while-discharge');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-telemetry','stock-ups','Telemetry Header','pin header (5V/3V3/I²C)','output','INA219-style battery V/I telemetry over I²C');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('pi5-40pin','pi5','40-Pin GPIO Header','40-pin header','bidirectional','Stacks on the driver board: takes 5V power + UART');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('pi5-usb','pi5','USB Host Ports','USB-A','bidirectional','Camera input');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('orin-uart','orin-nano','40-Pin Header (UART jumpers)','jumper wires','bidirectional','TX/RX/GND only — the Orin does not stack and cannot draw header 5V');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('orin-dc-in','orin-nano','DC Power Input','barrel jack','input','9–20V ~45W; fed from the battery rail, never the 5V host rail. Confirmed 2026-07-28: the UPS Module 3S board carries a factory barrel-jack pigtail for exactly this — center-positive, measured 11.5V, live-booted on it.');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('orin-usb','orin-nano','USB Host Ports','USB-A','bidirectional','Future ACCE camera and LiDAR host after cutover');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('oak-usb','oak-d-lite','OAK-D Lite USB','USB','output','RGB, stereo depth, and onboard vision data');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('d500-uart','d500-lidar','D500 UART','ZH1.5T-4P','output','STL-19P/LDS19 scan data at 230400 baud');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-motor-left','beast','Left Track Motor','PH2.0 6P','input','DC gear motor with encoder');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-motor-right','beast','Right Track Motor','PH2.0 6P','input','DC gear motor with encoder');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-pan-tilt','beast','Pan-Tilt (2× ST3215)','TTL bus daisy-chain','bidirectional','Stock 2-DOF camera mount on the servo bus');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-camera','beast','USB Camera','USB','output','5MP, 160° FOV, rides the pan-tilt');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-oled','beast','OLED Display','I²C','input','Voltage / IP telemetry readout');

-- documents + document_assets
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-gdb-schematic','General Driver for Robots — Schematic','schematic','beast/02-Driver-Board/General_Driver_for_Robots_Schematic.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-schematic','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-gdb-wiki','General Driver for Robots — Wiki','wiki','beast/08-Wiki-Pages/General-Driver-for-Robots_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-wiki','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-gdb-step','General Driver for Robots — STEP CAD','cad','beast/02-Driver-Board/General_Driver_for_Robots_STEP.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-step','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-ups-schematic','UPS Module 3S — Schematic','schematic','beast/03-Power-UPS/Ups01_Schematic.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-schematic','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-ups-wiki','UPS Module 3S — Wiki','wiki','beast/08-Wiki-Pages/UPS-Module-3S_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-wiki','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-ups-code','UPS Module 3S — INA219 Monitoring Code','firmware','beast/03-Power-UPS/UPS_Module_3S_Code.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-code','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-st3215-manual','ST3215 Servo — User Manual','manual','beast/04-Servos/ST3215_Servo_User_Manual.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st3215-manual','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-st-protocol','ST Serial Bus Servo — Protocol Manual','manual','beast/04-Servos/ST_Servo_Communication_Protocol_Manual.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st-protocol','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-st-circuit','ST Bus Servo — Control Circuit Schematic','schematic','beast/04-Servos/ST_Bus_Servo_Control_Circuit.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st-circuit','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-beast-wiki','UGV Beast — Wiki','wiki','beast/08-Wiki-Pages/UGV-Beast_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-wiki','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-beast-product','UGV Beast PT — Product Page','wiki','beast/08-Wiki-Pages/UGV-Beast_Product-Page.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-product','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-beast-cad','UGV Beast PT AI Kit — STEP CAD','cad','beast/05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-cad','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-orin-3d','UGV Beast PT Jetson Orin — 3D CAD','cad','beast/06-Jetson-Orin/UGV_Beast_PT_Jetson_Orin_3D.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-3d','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-3d','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-orin-wiki','UGV Beast PT Jetson Orin AI Kit — Wiki','wiki','beast/08-Wiki-Pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-wiki','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-esp32-firmware','UGV01 Base — ESP32 Firmware','firmware','beast/07-Code-Firmware/UGV01_BASE_ESP32_Firmware.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-esp32-firmware','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,library_path,url,note) VALUES ('doc-cp210x-driver','CP210x USB-UART Driver','firmware','beast/07-Code-Firmware/CP210x_USB_TO_UART_Driver.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-cp210x-driver','driver-board') ON CONFLICT DO NOTHING;

-- nets + net_terminals + net_documents
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-battery-rail','Battery Rail','power','3S pack · 9–12.6V','UPS → driver board; feeds motors + servo bus directly. The Orin taps this rail in the Jetson swap (the 5V host rail cannot power it).');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','ups-rail-out') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','gdb-power-in') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','orin-dc-in') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-ups-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-ups-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-5v-host','5V Host Rail','power','5V ≈5A (MP8759 buck)','Powers the Raspberry Pi 5 through the stacked 40-pin header.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-5v-host','gdb-5v-host') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-5v-host','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-5v-host','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-5v-host','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-host-uart','Host ↔ ESP32 UART','data','UART JSON commands + telemetry','The only Pi GPIO interface the robot occupies. Orin swap uses TX/RX/GND jumpers instead of stacking.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','gdb-host-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','orin-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-host-uart','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-host-uart','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-servo-bus','ST3215 Serial Servo Bus','mixed','TTL half-duplex @ 1 Mbps + pack voltage (5A limit)','Daisy-chained, ID-addressed. BEAST-01 uses the stock two-servo pan-tilt only.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-servo-bus','gdb-servo-bus') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-servo-bus','beast-pan-tilt') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st-protocol') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st-circuit') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st3215-manual') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-motor-left','Left Track Drive','mixed','TB6612FNG PWM + encoder feedback',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-left','gdb-motor-a') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-left','beast-motor-left') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-left','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-left','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-motor-right','Right Track Drive','mixed','TB6612FNG PWM + encoder feedback',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-right','gdb-motor-b') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-right','beast-motor-right') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-right','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-right','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-camera','Camera Feed','data','USB video (MJPEG upstream)',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-camera','beast-camera') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-camera','pi5-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-camera','orin-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-camera','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-oak-camera','OAK-D Lite RGB-D','data','USB RGB + stereo depth + device inference','Pi 5 is the current host; the Jetson becomes the host after cutover.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oak-camera','oak-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oak-camera','pi5-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oak-camera','orin-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-oak-camera','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-d500-lidar','D500 LiDAR Scan','data','STL-19P/LDS19 UART @ 230400 baud via USB bridge','ROS 2 uses LDLIDAR_MODEL=ld19; Pi 5 is the current host and Jetson is the cutover target.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-d500-lidar','d500-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-d500-lidar','gdb-lidar-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-d500-lidar','pi5-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-d500-lidar','orin-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-d500-lidar','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-oled-i2c','OLED Telemetry','data','I²C',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oled-i2c','gdb-i2c') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oled-i2c','beast-oled') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-oled-i2c','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-ups-telemetry','UPS Battery Telemetry','data','I²C V/I readings','Per the UPS wiki RPi wiring table (SDA/SCL/5V/GND); optional hookup on the Beast.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-ups-telemetry','ups-telemetry') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-ups-telemetry','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-ups-telemetry','doc-ups-wiki') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-ups-telemetry','doc-ups-code') ON CONFLICT DO NOTHING;

-- >>> DATACORE_CORPUS_BEGIN

-- briefing_packs (hub null until briefings exist)
INSERT INTO briefing_packs(id,title,code,summary,hub_briefing_id,topics) VALUES ('beast-vision','Beast Vision & Capture','RND-BEAST-VISION','Non-definitive research pack: offline splat architecture, servo-head camera candidate, killed paths, open LiDAR choice, and the method post-mortem.',NULL,ARRAY['vision','splat','gaussian','colmap','arducam','imx678','livox','mid-360','airy','rejected','thermal','fpv']::text[]);

-- briefings (body_markdown for all kinds; repo_path is provenance)
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('robot-control-llms','Robot Control LLMs — Hangar Briefing','research','Three-lane taxonomy for LLM robot control (orchestrator / VLA / world-action model), Cosmos 3 Edge analysis, Orin Nano fit matrices, and the recommended Hangar progression. Codename RND-ROBOT-LLM; insights persisted in hangar.ts.',ARRAY['llm','vla','autonomy','orin','control','research']::text[],ARRAY['rnd-robot-llm','cosmos','world action model','orchestrator']::text[],NULL,'2026-07-22','/datacore/briefing/robot-control-llms',$b_robot_control_llms$# Robot Control LLMs — Hangar Briefing

**Status:** RESEARCH BRIEF — sourced 2026-07-22. No robot behavior, deploy, or inventory
purchase decisions are changed by this document.

**Codename:** `RND-ROBOT-LLM`

**Audience:** Hangar operator + agents planning BEAST-01 control and autonomy.

**North Star:** Autonomy is in scope (**G7**, decided 2026-07-22). The old AG2 ban on
unattended / autonomous operation is repealed. Onboard fail-safes (e-stop, stale-command
watchdog, motor PID) remain engineering requirements — they do not forbid self-driving.

---

## Verdict for BEAST-01

Treat “robot control LLMs” as **three different products**, not one:

| Lane | What it does | Hangar fit now |
| --- | --- | --- |
| **A. Language orchestrator** | NL / voice → structured teleop or Nav2 goals | Near-term after Socket.IO / ROS2 cutover; runs offboard on CORE-PRIME |
| **B. VLA / imitation policy** | Camera (+ language) → continuous actions | Self-driving path after Orin cutover + demo recording; LeRobot / SmolVLA / ACT first |
| **C. World action model (WAM)** | Shared world model that reasons, simulates, and emits actions | Autonomy research + post-train; NVIDIA Cosmos 3 Edge is the headline open edge checkpoint |

**Current physical gate:** Pi is **out**, Orin is being fitted — no upper computer on the
chassis until that install lands (OP-ORIN-GAP). That is a host-swap blocker, not a policy ban.

**Dynamics correction (operator, 2026-07-22):** Beast is slow, hard-stops, and **stops in
time** for terrain/obstacle reactions. Remote closed-loop from CORE-PRIME is fine.
Lightweight on-device Orin inference for **terrain alignment / avoidance** is fine.
Rejected: "won't stop in time," "avoidance must stay classical-only," WiFi-tail vetoes.
Keep ESP32 PID + watchdog.

---

## Why Cosmos 3 Edge is actually interesting for Hangar

Not because Thor is on the buy list. Because it is the first open **world-action** tier in
the NVIDIA Physical AI stack Hangar already lives in (Orin host, 5090 train box, JetPack /
Isaac / ROS path).

| Interest | Why it maps to BEAST |
| --- | --- |
| **World model, not just a VLA** | Same weights can reason about a scene, predict the next view, and emit actions. Crawlspace work is mostly “what happens if I creep under that duct,” not tabletop pick-and-place. |
| **Action + expected visual consequence** | Policy mode returns a move *and* a predicted outcome — useful for Hangar review, demo mining, and Undercroft rehearsal before floor contact. |
| **Common action geometry** | Translation / rotation / manipulation-state vectors across embodiments. Tracks + gimbal are an adapter + post-train problem, not a different universe. |
| **4B open edge checkpoint + post-train scripts** | Stock DROID arm policy is the wrong body; the valuable part is the open post-train path (“~a day” vendor claim) onto Beast sensors/demos on CORE-PRIME, then deploy. |
| **Orin is still in the family** | Vendor 15 Hz / 32-action figures are quoted on **Jetson Thor**. Separately, NVIDIA calls out running the **~2B Nemotron / Cosmos Reasoner path on Jetson Orin 8GB**. Beast’s slow dynamics mean even sub-Thor Hz is useful for drive + terrain alignment. |
| **5090 is the gym; Orin is the field** | Post-train / distill / eval on CORE-PRIME; run lighter policies and reasoners on Orin; keep remote closed-loop as a first-class alternate. |

So the pull is: **open physical-AI world model you can specialize to this rover**, not “must buy Thor to matter.”

---

## What we would actually have it do on BEAST-01

The Beast is a tracked rover with pan-tilt camera (and later depth/LiDAR), not an arm.
Operator fact: the Beast is **slow and hard-stops** — remote control is not exotic.
The end state is **self-driving on missions** — crawlspace cable haul, perimeter runs,
deck lanes — with Hangar as the command portal that starts, monitors, and aborts policies.

Build in stages so autonomy is earned, not wished:

### Jobs worth building (ordered)

| # | Job on the Beast | Lane | Concrete behavior |
| --- | --- | --- | --- |
| 1 | **Phrase driving** for Undercroft | A | “Creep forward under the duct”, “nudge left past the pillar”, “spin 90°”, “stop” → clamped `{L,R,duration}` / `/cmd_vel`. Hard speed caps; unknown verbs rejected. First autonomy-shaped interface. |
| 2 | **Look-where-I-mean** gimbal | A (+ VLM) | “Look at the cable end”, “tilt up at the joists”, “scan left for the orange conduit” → pan-tilt setpoints from FPV + phrase. |
| 3 | **Scene coach / HUD** | A (VLM) | Stream FPV to CORE-PRIME; narrate clearances into Hangar while driving or while a policy runs. |
| 4 | **Terrain alignment / avoidance** | onboard light | Lightweight Orin inference (depth/LiDAR/CV) for terrain alignment and obstacle avoidance — chassis stops in time; normal onboard job. |
| 5 | **Cable-haul autonomy** | A→B | MSN-01: approach corridor, optional human cable attach, then autonomous reverse haul with live abort. |
| 6 | **Taught crawl / patrol policies** | B | Closed-loop ACT/SmolVLA or Cosmos Edge post-train — remote and/or on-device. |
| 7 | **Cosmos-class world model** | C | Train/eval on 5090; post-train for Beast tracks (stock DROID arms do not transfer). |

### Mission fit

- **Undercroft (MSN-01):** phrase drive → taught crawl → autonomous cable haul is the
  flagship autonomy story.
- **Perimeter mapping (MSN-02):** classical SLAM/Nav plus language goals (“inspect that
  fence line”); later a patrol policy on the map.
- **Pool deck (MSN-03):** autonomy only inside marked exclusion zones and low-speed
  profiles — self-driving with hard geofence, not a free roam near water.

### Explicit non-jobs on this chassis

- Replacing ESP32 PID / stale-command stop with a transformer (fail-safes stay)
- Running stock Cosmos Edge Policy-DROID (arm pick-and-place) as if it were UGV drive

### Explicitly rejected agent conclusions

- "Won't stop in time" on this chassis
- "Collision / terrain avoidance can't be lightweight onboard inference"
- "Remote visual steering is too dangerous because of WiFi tails"

### One-sentence product picture

**Hangar launches a Beast policy (or phrase goal); the rover drives the mission closed-loop;
silence, abort, or geofence breach → stop.**

---

## 1. Why this briefing exists

BEAST-01’s operating progression already ends with “ROS2 … even LLM-driven natural-language
control” (`docs/beast-ops.md`). The fleet also already encodes an offload doctrine:

- CORE-PRIME (RTX 5090): train + heavy VLM/VLA when useful; remote Beast control OK
- BEAST-JETSON (Orin, fitting): teleop, stream, lightweight terrain avoidance, onboard policies
- Watchdog/PID stay; WiFi-tail lore is not a Beast teleop veto (`beast-slow-hard-stop`)

July 2026 NVIDIA / Hugging Face releases (Cosmos 3 family, Cosmos 3 Edge, LeRobot ↔ GR00T /
Cosmos integrations) make the research horizon concrete enough to map onto that doctrine
instead of collecting model names.

Context7 checked: Context7 MCP unavailable in this environment; facts below are from
Hugging Face model cards / blogs, NVIDIA blogs, GitHub repos (live star counts), and
existing Hangar owner docs.

---

## 2. Taxonomy — stop conflating these

### Lane A — Language orchestrators (LLM as planner / coder)

Pipeline: speech or text → LLM → **validated** JSON / ROS messages / short action scripts →
existing controllers (Socket.IO `{"T":1,"L","R"}`, `/cmd_vel`, Nav2).

- Strength: cheap to stand up; reuses classical stacks; good for goal-level autonomy and
  scripted mission segments.
- Weakness: not continuous closed-loop control; grounding fails without vision or a map;
  latency is turn-based (hundreds of ms to seconds), so it plans / sequences rather than
  servoing.
- UGV-relevant pattern: multimodal planner that returns a short validated action plan from
  a voice command + camera frame, then clamps speeds before driving (see Cyberwave UGV
  voice tutorial pattern — plan verbs, not learned continuous control).

### Lane B — Vision-Language-Action (VLA) policies

Pipeline: image(s) + language instruction → model → **motor actions** (discrete tokens or
continuous chunks / flow matching).

Landmark families (2024–2026):

| Model | Params (approx.) | Action style | Open weights | Notes |
| --- | ---: | --- | --- | --- |
| RT-2 / RT-2-X | up to ~55B | Discrete action tokens | No | Established the VLA paradigm (DeepMind, 2023) |
| OpenVLA | ~7B | Discrete bins as tokens | Yes | Default open baseline; [openvla/openvla](https://github.com/openvla/openvla) (6.7k stars) |
| π0 / π0.5 / openpi | ~3B class | Flow matching continuous | Partial (openpi) | Dexterity / smoothness leader; [Physical-Intelligence/openpi](https://github.com/Physical-Intelligence/openpi) (12.9k stars) |
| SmolVLA | ~0.45–2B | Continuous / chunked | Yes | Consumer-GPU friendly; lives in LeRobot |
| Octo / TinyVLA | small | Diffusion / discrete | Yes | Lightweight / embedded experiments |
| Isaac GR00T N1.x | ~2B+ | Dual-system VLM + DiT actions | Yes (code Apache 2.0; weights NVIDIA open model license) | Humanoid / cross-embodiment focus; [NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) (7.6k stars) |

LeRobot ([huggingface/lerobot](https://github.com/huggingface/lerobot), **26.0k stars**) is
the practical open software spine: ACT, Diffusion, SmolVLA, π0 family bindings, GR00T
policy type, datasets, and rollout tooling. Hangar already records this as optional
software, not platform branding (`lerobot-optional`).

### Lane C — World foundation / world action models

Pipeline: multimodal world state → shared representation → **reason and/or generate**
future video **and** actions (forward / inverse dynamics + policy).

This is where **NVIDIA Cosmos 3** sits. Earlier Cosmos pieces were separate Predict /
Transfer / Reason / Policy models; Cosmos 3 unifies them as an omni-model
(Mixture-of-Transformers: autoregressive tower for understanding + diffusion tower for
generation). Cosmos 3 Edge is the compact edge post-train of that family aimed at
on-device robot control.

---

## 3. Deep dive — Cosmos 3 Edge (required source)

Primary announcement: [Introducing Cosmos 3 Edge](https://huggingface.co/blog/nvidia/cosmos3edge)
(Hugging Face community article, NVIDIA authors, published **2026-07-20**).

Model card: [`nvidia/Cosmos3-Edge`](https://huggingface.co/nvidia/Cosmos3-Edge)
(~6.6k downloads / 75 likes at briefing time; OpenMDW 1.1).

Sibling framing: [Welcome NVIDIA Cosmos 3](https://huggingface.co/blog/nvidia/cosmos-3-for-physical-ai)
(2026-05-31) and NVIDIA’s Jetson Thor edge blog covering Edge deployment on Thor
platforms.

### What shipped

- **Cosmos 3 Edge** — 4B-parameter open world / world-action model for edge Physical AI.
- Positioned as a compact VLM **and** a post-trained **world action model (WAM)** that can
  understand scenes, reason in real time, and generate robot actions on-device.
- Claimed robot-control operating point: **640×360** observations, **32 actions per
  inference**, real-time control about **15 Hz on Jetson Thor**.
- Hardware targets called out: RTX PRO / DGX / GeForce RTX, and Jetson including newly
  announced **Thor T2000 / T3000** modules (mainstream Thor SKUs; modules themselves
  called for **Q1 2027** availability in NVIDIA’s Thor blog).
- Companion checkpoint: **Cosmos 3 Edge Policy (DROID)** — manipulation policy post-trained
  on DROID pick-and-place, with post-training scripts ([NVIDIA/cosmos-framework](https://github.com/NVIDIA/cosmos-framework),
  397 stars; umbrella [NVIDIA/cosmos](https://github.com/NVIDIA/cosmos), **11.2k stars**).
- Among ~4B peers, NVIDIA claims #1 on **VANTAGE-Bench** (vision analytics) and SOTA for
  robot policy learning at that size — treat as vendor benchmark until Hangar reproduces
  anything locally.

### Architecture that matters for operators

Two transformer towers, one shared multimodal attention:

1. **Autoregressive tower** — vision/text tokens → understanding / reasoning.
2. **Diffusion tower** — vision / audio / action tokens → prediction, generation, neural
   simulation.

Actions are mapped into a **common geometric action representation** (translation,
rotation, manipulation state) so different embodiments (camera ego-motion, AV pose, arm
EEF + grasp, etc.) share structure. Policy mode emits **action + expected visual
consequence** — useful for training / evaluation, not only open-loop command spit.

Cosmos 3 family sizes for context:

| Checkpoint | Approx. size | Role |
| --- | ---: | --- |
| Cosmos 3 Edge (+ Policy-DROID) | 4B | Edge reasoner / action generator |
| Cosmos 3 Nano (+ Policy-DROID) | 16B | Workstation-class omni WFM |
| Cosmos 3 Super (+ distilled 4-step gens) | 64B | Large SDG / research generation |

### Hangar read on Cosmos 3 Edge specifically

**Useful as research and future post-train substrate. Not a BEAST buy trigger.**

Reasons it does **not** move Thor onto the buy list today:

1. Vendor real-time numbers are for **Jetson Thor**, not Orin Nano Super (the owned edge
   CUDA target). Edge is “Thor-native marketing,” even if Ampere/Blackwell workstation
   GPUs are listed for inference.
2. Stock policy release is **DROID arm pick-and-place**, not Waveshare tracked UGV
   differential drive. Embodiment transfer requires post-training on Beast demos /
   sim — exactly the Cosmos “post-train in about a day” story, but still unpaid work.
3. Autonomy is in scope (G7); Edge still needs Beast-specific post-train before closed-loop
   UGV deploy — stock DROID is the wrong embodiment, not a policy ban.
4. Existing Hangar insights already say Thor is industrial-tier for large onboard VLAs
   (`thor-tier`). T2000/T3000 soften the price/power curve later; they do not erase the
   “hobby rover within AP range” offload doctrine.

**Where Edge *does* fit Hangar compute:**

- **CORE-PRIME (5090):** fine-tune / distill / evaluate Cosmos Edge or Nano; generate
  synthetic trajectories; run heavier reasoner modes and closed-loop offboard policies.
- **BEAST-JETSON (Orin Nano Super):** after cutover, candidate for **smaller** LeRobot
  policies (ACT / SmolVLA class) and classical Isaac / ROS perception — not assumed to
  host full Edge 15 Hz claims.
- **Thor research row:** keep as horizon hardware if/when an onboard WAM is required
  outside WiFi coverage; revisit when T2000 street availability and power budget are real.

---

## 4. Map onto Hangar architecture

```text
 Operator (Hangar UI / voice)
        │  launch / monitor / abort
        ▼
 ┌──────────────────────────────┐
 │ CORE-PRIME  RTX 5090         │  Lane A LLM planner
 │  + VLA / Cosmos policies     │  Lane B/C train + offboard infer
 └─────────────┬────────────────┘
               │ WiFi 6 (design for tail)
               ▼
 ┌──────────────────────────────┐
 │ Onboard host (Orin — fitting)│  stream · watchdog · onboard policy
 │  Pi removed 2026-07-22       │
 └─────────────┬────────────────┘
               │ UART JSON
               ▼
         ESP32 PID / stop
```

Binding rules (operator-corrected for Beast):

- Train heavy models on CORE-PRIME when convenient (`offload-split`).
- Beast remote closed-loop and onboard lightweight terrain avoidance are both in play.
- Motor PID + stale-command watchdog stay as hard fail-safes (`watchdog`).
- Do not claim the Beast "can't stop in time" or that avoidance is forbidden onboard.

Suggested capability layering (conceptual — not schema changes):

1. **NL goal / teleop** (Lane A) on Socket.IO / later ROS2.
2. **Demo recording** to `/data/beast/datasets` once NVMe storage policy is applied.
3. **LeRobot ACT / SmolVLA** closed-loop on lifted tracks, then floor.
4. **Cosmos Edge / Nano** post-train after (2)–(3) and Beast action adapters exist.

---

## 5. Recommended Hangar progression

Ordered so each step earns more autonomy without skipping fail-safes:

1. **Finish Orin physical install** (Pi already removed) — mount, power, UART to ESP32,
   USB camera/LiDAR, move beast DHCP/DNS identity, heartbeat-stop check. See OP-ORIN-GAP.
2. **Drive remote immediately** — Hangar / browser / CORE-PRIME teleop and closed-loop are
   first-class on this slow hard-stopping chassis; keep watchdog, skip false babysitting rules.
3. **Lane A** — phrase goals → clamped `{L,R,duration}` / Nav2; hard speed caps; abort live.
4. **Record demos** for Undercroft / deck / perimeter once storage layout lands.
5. **Lane B closed-loop** — ACT/SmolVLA on CORE-PRIME and/or Orin; floor autonomy with abort.
6. **Lane C / Cosmos Edge** — 5090 spike + Beast track post-train; on-device when it fits;
   do **not** buy Thor just for the spike.

Still dumb:

- Replacing PID / watchdog with the transformer.
- Assuming stock DROID arm checkpoints drive tracks.
- Claiming the Beast can't stop in time or can't run lightweight onboard avoidance.

---

## 6. Orin Nano 8GB — what else is actually SOTA-adjacent and fits

Usable unified memory on Orin Nano is roughly **~7.6 GB** after OS. Memory is the gate; Beast
being slow means **Hz budgets are forgiving** (single-digit control Hz can still be useful).

Context7 checked: Context7 MCP unavailable; sizing below from Jetson AI Lab / TensorRT
Edge-LLM docs, NVIDIA SIGGRAPH notes, LeRobot ecosystem, and published Jetson VLA fit matrices
(accessed 2026-07-22).

### A. Vision-language-action / policies (closed-loop drive)

| Model | Size | Orin Nano 8GB fit | Notes for Beast |
| --- | ---: | --- | --- |
| **SmolVLA** (HF LeRobot) | ~450M (~1.6 GB) | **Best first fit** — ~15–25 ms class with ORT-TRT/INT8 in published Jetson notes | Production Nano-class VLA; post-train on Beast demos via [huggingface/lerobot](https://github.com/huggingface/lerobot) (26.0k stars) |
| **Isaac GR00T N1.6 / N1.7** | ~3B (~4.4 GB FP16) | **Fits with headroom** | Stronger NVIDIA VLA; humanoid-heavy pretrain; still a post-train candidate; [NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) (7.6k stars) |
| **TinyVLA / MiniVLA-class** | ~1B | Likely fits | Embedded VLA experiments; less ecosystem than SmolVLA |
| **π0 / π0.5 (openpi)** | ~3.5B | **Usually no** in full form (~12–13 GB); SnapFlow 1-step FP16 student ~6.5 GB is a **tight maybe** | Quality leader; treat as 5090 train / distill target, not day-one Nano |
| **OpenVLA 7B** | ~7.5B | **No** for real-time on Nano | Keep as 5090 research / OFT recipes only |
| **Cosmos 3 Edge** | 4B WAM | **Try on 5090 first**; Thor-quoted 15 Hz; Orin may run slower or reasoner-only | World-action + post-train path (see above) |

### B. VLMs (scene coach, terrain language, “is the path under the duct clear?”)

| Model | Size | Orin Nano note |
| --- | ---: | --- |
| **SmolVLM / SmolVLM2** | 256M–2.2B | Comfortable; used in edge voice-to-action stacks |
| **InternVL3 1B / 2B** | 1–2B | Published Orin Nano TensorRT numbers (tens of tok/s quantized) |
| **Qwen2.5-VL / Qwen3-VL 2B–3B** | 2–3B | Common Orin Nano VLM ceiling with INT4/FP16 |
| **Cosmos Reason ~2B** | ~2B | NVIDIA explicitly calls out Orin 8GB for this reasoner path |
| **VILA 1.5 ~3B / Gemma 3 4B VLM** | 3–4B | Upper end of comfortable Nano VLMs |

### C. Text LLMs (Lane A phrase → JSON / ROS goals)

| Model | Size | Orin Nano note |
| --- | ---: | --- |
| **Qwen3 1.7B / 4B** (INT4 AWQ) | 1.7–4B | TensorRT Edge-LLM Orin Nano path; 4B INT4 ~2 GB weights |
| **Nemotron-3-Nano 4B** | 4B | NVIDIA edge LLM; Edge-LLM supported |
| **Gemma 3 1B / 4B**, **Llama 3.2 3B** | 1–4B | Fine for goal parsing / tool-calling on-device |

### D. Runtimes that matter on Orin

- [NVIDIA/TensorRT-Edge-LLM](https://github.com/NVIDIA/TensorRT-Edge-LLM) (481 stars) — Jetson C++ LLM/VLM path
- LeRobot train on 5090 → ONNX/ORT-TRT or TensorRT on Orin (JetPack Python ≠ LeRobot’s 3.12 train env; export off-device)
- Classical CV / depth / LiDAR tricks for terrain alignment still count as “lightweight onboard inference”

### Practical Hangar shortlist (once Orin is seated)

1. **SmolVLA** — first closed-loop policy candidate on-device  
2. **Qwen3-VL 2B or InternVL3-1B/2B + Qwen3-4B INT4** — scene coach + phrase driving on Orin  
3. **GR00T N1.x** — second VLA if SmolVLA is too small after Beast post-train  
4. **Cosmos Reason 2B / Cosmos 3 Edge** — reasoner now; full WAM post-train on 5090, measure Orin Hz later  
5. Keep **π0 / OpenVLA** on CORE-PRIME unless distilled to Nano-sized students  

---

## 7. Decision matrix (Hangar-specific)

| Question | Answer |
| --- | --- |
| Why care about Cosmos 3 Edge? | Open world-action model + post-train path in the NVIDIA stack Hangar already uses; action+future-view; Orin reasoner path exists. |
| Best Orin-first VLA? | **SmolVLA**, then GR00T N1.x if needed. |
| Best Orin-first VLM / LLM pair? | Qwen3-VL or InternVL3 (2B-class) + Qwen3-4B / Nemotron-Nano-4B INT4. |
| Does Edge force a Thor buy? | No. |
| Best first LLM control for Beast? | Lane A over ROS2 once Orin is in; remote closed-loop OK. |
| Hangar UI role? | Command portal: telemetry, video, teleop, remote + on-device autonomy. |

---

## 8. Open questions

- Measured Cosmos 3 Edge and Cosmos Reason 2B Hz / VRAM on **this** Orin Nano Super (not vendor Thor slides).
- Beast differential-drive + gimbal action adapter for Cosmos / GR00T / SmolVLA.
- How soon SmolVLA post-train beats Lane A scripts for Undercroft haul.
- Whether a SnapFlow-style π0 student is worth the Nano memory squeeze vs just using SmolVLA.

---

## 9. Sources (accessed 2026-07-22)

### Primary — Cosmos

- [Introducing Cosmos 3 Edge](https://huggingface.co/blog/nvidia/cosmos3edge) — required brief source
- [`nvidia/Cosmos3-Edge` model card](https://huggingface.co/nvidia/Cosmos3-Edge)
- [Welcome NVIDIA Cosmos 3](https://huggingface.co/blog/nvidia/cosmos-3-for-physical-ai)
- [NVIDIA Jetson Thor / Cosmos 3 Edge blog](https://blogs.nvidia.com/blog/jetson-thor-robotics-edge-ai-agent/)
- [NVIDIA/cosmos](https://github.com/NVIDIA/cosmos) (11.2k stars)
- [NVIDIA/cosmos-framework](https://github.com/NVIDIA/cosmos-framework) (397 stars)

### VLA / tooling landscape

- [huggingface/lerobot](https://github.com/huggingface/lerobot) (26.0k stars)
- [NVIDIA ↔ Hugging Face LeRobot / GR00T / Cosmos note](https://blogs.nvidia.com/blog/hugging-face-lerobot-models-frameworks-open-robotics/)
- [NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) (7.6k stars)
- [openvla/openvla](https://github.com/openvla/openvla) (6.7k stars)
- [Physical-Intelligence/openpi](https://github.com/Physical-Intelligence/openpi) (12.9k stars)
- [NVIDIA/TensorRT-Edge-LLM](https://github.com/NVIDIA/TensorRT-Edge-LLM) (481 stars)
- [Jetson AI Lab — TensorRT Edge-LLM](https://www.jetson-ai-lab.com/tutorials/tensorrt-edge-llm/)
- [Deploying VLAs on Jetson (fit matrix)](https://jared-hpc.com/posts/vla-physical-ai-tensorrt-tether/)
- [NVIDIA SIGGRAPH / Cosmos Edge + Orin reasoner note](https://blogs.nvidia.com/blog/siggraph-news-2026/)
- Wikipedia — [Vision–language–action model](https://en.wikipedia.org/wiki/Vision%E2%80%93language%E2%80%93action_model) (background only)

### Lane A / UGV NLP control patterns

- [Cyberwave — voice-controlled UGV Beast tutorial](https://cyberwave.mintlify.app/tutorials/ugv-voice-controlled) (orchestrator pattern; not Hangar-endorsed stack)
- arXiv — [LLM NL commands for ROS 2 navigation](https://arxiv.org/html/2506.00075v1)

### Hangar owner truth

- `docs/NORTH_STAR.md` — G7 live command portal; autonomy in scope (AG2 repealed 2026-07-22)
- `docs/beast-ops.md` — Pi/Jetson stack, Socket.IO control, operating progression
- `src/data/hangar.ts` — insights `offload-split`, `wifi-tail`, `watchdog`, `thor-tier`,
  `lerobot-optional`, `robot-llm-lanes`, `beast-llm-jobs`

---

## Persistence

- Full brief: this file.
- Datacore insights: `robot-llm-lanes`, `beast-llm-jobs`, `orin-edge-model-shortlist` in `src/data/hangar.ts`.
- Related Datacore brief: [/datacore/compute-workload](/datacore/compute-workload) (Orin NX vs AGX linked-view sizing).
- Activity ticker: researched event for `RND-ROBOT-LLM`.
- `docs/beast-ops.md`: one-line research pointer under operating progression / references.
$b_robot_control_llms$,'content/datacore/robot-control-llms.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('compute-workload','Compute Workload Sizing — Orin NX vs AGX Orin','research','How engineers formally represent the workload that leads to Orin NX versus AGX Orin: linked views from requirements through measured runtime — not a single TOPS diagram.',ARRAY['compute','jetson','orin','sizing']::text[],ARRAY['tops','agx','orin nx','workload','pipeline']::text[],NULL,'2026-07-23','/datacore/briefing/compute-workload',$b_compute_workload$# Compute Workload Sizing — Orin NX vs AGX Orin

**Status:** RESEARCH BRIEF — sourced 2026-07-23. Documents how teams prove edge-module fit. Does not by itself force a purchase.

**Codename:** `RND-COMPUTE-SIZING`

**Audience:** Hangar operator + agents planning BEAST-01 / Jetson tier decisions.

---

You were asking **how engineers formally represent the workload that leads to Orin NX versus AGX Orin**, not for another list of deployments.

The clearest answer from current robotics courses, class projects, ROS discussions, and 2026 Jetson engineering threads is:

> **They do not make one “AI compute requirements diagram.”**
> They use several linked views: operational requirements → functional dataflow → cyber-physical allocation → timing/interfaces/resources → measured runtime traces.

That distinction matters because an apparently impressive “275 TOPS” requirement can actually be caused by **camera ingress, ISP, memory, encoding, synchronization, or concurrent CPU work**, rather than neural inference.

## 1. Start with an objective tree and quantified requirements

The first visual is normally not a ROS graph. It is an **objective or requirement hierarchy** showing:

* What the robot must accomplish.
* Mandatory threshold versus desirable target.
* Performance, functional, safety, and nonfunctional requirements.
* How success will be measured.

The Spring 2026 Johns Hopkins **System Conceptual Design** course explicitly progresses from stakeholder needs and scenarios through requirements, traceability, functional allocation, physical allocation, resource allocation, and validation. It teaches context diagrams, block-definition diagrams, activity diagrams, timeline diagrams, N² diagrams, internal-block diagrams, concurrency, and resource allocation. ([JHU Application Portal][1])

CMU’s robotics systems-engineering sequence similarly has students move through conceptualization, specification, design, prototyping, requirements tracking, cyber-physical architecture, testing, and system-performance validation. ([CMU Course Catalog][2])

Two actual CMU project examples show what this looks like:

* **VectorRobotics, 2026:** system performance requirements, functional architecture, cyber-physical architecture, and both general and detailed objective trees. ([MRSD Projects][3])
* **NightWalker:** separate mandatory and desirable functional, performance, and nonfunctional requirements, followed by functional and cyber-physical architectures. ([MRSD Projects][4])

This part answers **what performance is needed**. It does not yet select the Jetson.

## 2. Draw a functional architecture as concurrent data pipelines

The functional view contains **functions and information flows**, not particular computers.

A serious autonomy diagram would look conceptually like:

```text
Cameras ──→ rectify/dewarp ──→ depth/inference ─┐
                                                │
LiDAR ────→ filtering ───────→ lidar odometry ──┼→ localization/map
                                                │
IMU ──────→ preprocessing ───→ state estimate ──┘
                                                     ↓
                                               planning/control
```

What matters is that the diagram shows:

* Which paths execute continuously.
* Which paths execute concurrently.
* Their input and output rates.
* Which results are dependencies for other functions.
* Which paths are safety-critical.
* Which paths can be degraded or dropped.

NightWalker’s functional architecture, for example, explicitly separates three concurrent pipelines:

1. Perception-based planning.
2. SLAM and state estimation.
3. Human detection and localization.

Its SLAM path consumes lidar, IMU, and stereo data; the resulting map and robot pose feed both exploration and human localization. ([MRSD Projects][4])

That is much more useful for compute sizing than writing “SLAM + YOLO + navigation” in a feature list.

## 3. Map the functions onto a cyber-physical architecture

The next diagram answers:

> **Which processor, controller, accelerator, sensor, and interface performs each function?**

This is where the difference between Orin NX and AGX Orin becomes visible.

### Actual Orin NX class-project example

The University of Texas at Arlington’s 2025 IGVC senior-design rover documents three layers:

```text
Input
  Cameras, lidar, GPS, encoders, emergency switches

Processing
  Orin NX: vision, lidar perception, decisions
  TM4C: low-level communication and motor control

Output / safety
  Motor driver and wheels
  Separate STM32 wireless emergency-stop path
```

Its project package includes a project charter, system-requirements specification, architecture-design specification, detailed-design specification, wiring schematic, and logic block diagram. ([UT Arlington Websites][5])

That is a proper allocation diagram, although the published evidence does **not** demonstrate that Orin NX was the minimum compute necessary. It establishes responsibilities and safety isolation, not utilization.

### Actual AGX Orin class-project example

CMU’s 2026 **FireSense** project uses an objective tree, requirements diagrams, functional architecture, and cyber-physical architecture. Each firefighter-carried payload contains thermal stereo cameras, mmWave radar, IMU, battery, communications, and an **AGX Orin**. The AGX performs front-end SLAM and point-of-interest detection; lightweight constraints are transmitted over a 915 MHz link to a command station that performs centralized collaborative-SLAM optimization. ([MRSD Projects][6])

That architecture communicates something important:

* High-volume sensor processing stays local.
* Low-bandwidth constraints traverse the radio.
* Global optimization is offloaded.
* The compute requirement is divided between edge and command station.

Again, the public project page documents the allocation well, but it does not publish enough profiling to prove that AGX Orin is the smallest acceptable module.

## 4. Use an N² or interface matrix

A block diagram tells you **what connects**. An N² matrix or interface-control table tells you whether the connections can actually support the workload.

Typical fields are:

| Producer  | Consumer          | Data         |  Rate |           Payload size | Interface | Required latency | Timebase      |
| --------- | ----------------- | ------------ | ----: | ---------------------: | --------- | ---------------: | ------------- |
| Camera 1  | Rectifier         | RAW Bayer    | 30 Hz | Resolution × bit depth | CSI-2     |         Deadline | Camera clock  |
| Rectifier | Detector          | Tensor/image | 30 Hz |               Measured | CUDA/NVMM |         Deadline | Jetson clock  |
| Lidar     | LIO               | Point cloud  | 10 Hz |           Points/frame | Ethernet  |         Deadline | PTP/GNSS      |
| Jetson    | Flight controller | Setpoint     | 50 Hz |          Bytes/message | UART/CAN  |         Deadline | Synced clocks |

JHU’s 2026 course explicitly teaches **N² diagrams**, requirements-to-function traceability, function-to-physical traceability, timeline diagrams, physical concurrency, and resource allocation. ([JHU Application Portal][1])

This is especially important for Jetson selection because **the carrier board and physical interfaces can invalidate the SoC choice**.

A May 2026 forum discussion comparing Orin NX 16GB with AGX Orin 64GB specified:

* Three cameras.
* 100 FPS each.
* 300 FPS total.
* 67 FPS as the strict minimum.
* Cable movement at 160 m/min.
* Near-immediate processing.
* Concern over memory and input bandwidth.

The user selected AGX Orin and a dedicated PCIe multiport interface after the discussion identified the NX development carrier’s 1GbE PHY as an input bottleneck. The decision was therefore partly an **I/O architecture decision**, not a 100-versus-275-TOPS decision. ([NVIDIA Developer Forums][7])

## 5. Build a timeline and end-to-end latency budget

Averages alone are not sufficient. Robotics designers need the **critical path** from physical event to actuator response.

```text
Exposure
  → camera transfer
  → ISP/debayer
  → preprocessing
  → inference
  → tracking/fusion
  → planner
  → controller communication
  → actuator update
```

For every stage they track:

* Nominal time.
* Worst-case or high-percentile time.
* Jitter.
* Queueing delay.
* Deadline.
* Whether frames may be skipped.
* Whether stale output is usable.

A 2026 DJI Matrice 300 tracking implementation using Orin NX drew both a system framework and physical interconnection architecture, then defined end-to-end latency from image acquisition through PSDK command execution. It measured a mean of **29.13 ms** with **0.76 ms standard deviation** under dynamic load. ([PMC][8])

A November 2025 PX4 discussion involving AGX Orin and Pixhawk shows why clock architecture belongs in the same document. The user plotted Jetson/Pixhawk clock offset, NTP-induced jumps, steady drift, and timestamp errors reaching approximately 20 ms—unacceptable for the sensor-fusion requirement. ([Dronecode Forum][9])

So the timing view must include both:

1. **Compute latency**, and
2. **Timestamp validity and synchronization error**.

## 6. Make a resource-allocation matrix by hardware engine

A Jetson is not one homogeneous bucket of TOPS.

A useful allocation table separates:

| Function        | CPU |      GPU |    DLA 0 |    DLA 1 | ISP | NVENC | NVDEC |              RAM |          I/O |
| --------------- | --: | -------: | -------: | -------: | --: | ----: | ----: | ---------------: | -----------: |
| Camera ingest   |     |          |          |          |   ✓ |       |       |          buffers |  CSI/USB/GbE |
| Rectification   |   ✓ |        ✓ |          |          |     |       |       |          buffers |     internal |
| Detection model |     |        ✓ | possibly | possibly |     |       |       | engine + tensors |     internal |
| Recording       |   ✓ |          |          |          |     |     ✓ |       |           queues |         NVMe |
| VIO/SLAM        |   ✓ | possibly |          |          |     |       |       |        map/state | camera + IMU |
| Dense depth     |   ✓ |        ✓ | possibly | possibly |     |       |       |    large tensors |       camera |

Current engineering discussions show why this breakdown is mandatory:

* A December 2025 Orin NX design listed **three camera inputs, two primary models, three secondary models, and six simultaneous encoding outputs**—one recording and one streaming encode for each camera. ([NVIDIA Developer Forums][10])
* A June 2026 Orin NX evaluation separately asked about **four 4K30 RAW camera streams, ISP processing, real-time inference, encoding, and decoding**, rather than treating them as one generic AI workload. ([NVIDIA Developer Forums][11])
* An April 2026 AGX Orin deployment with seven camera channels experienced simultaneous frame drops and NVMe I/O failures while packaging and transmitting the streams, showing that camera, memory, storage, and network concurrency must be tested together. ([NVIDIA Developer Forums][12])

### GPU and DLA need explicit allocation

A 2025 Orin NX discussion measured:

* GPU-only YOLOv7-Tiny: 238 FPS.
* GPU plus both DLAs: 141 FPS GPU plus 42 FPS per DLA, 225 FPS total.

Unsupported layers fell back to the GPU, and transfers reduced aggregate performance. NVIDIA’s advice was to minimize intermediate transfers and, where possible, place an entire model on one engine. ([NVIDIA Developer Forums][13])

Therefore a diagram saying **“model runs on GPU/DLA”** is inadequate. It needs to show:

* Model partition boundaries.
* Unsupported operators.
* Fallback paths.
* Tensor copies.
* Shared preprocessing.
* Concurrent engines.

## 7. Visualize the implemented ROS graph separately

The design architecture and the runtime architecture are not the same artifact.

In a ROS Discourse discussion specifically asking how people visualize ROS 2 architectures, participants recommended:

* `rqt_graph` for node/topic structure.
* `ros2_graph` and Mermaid for documentation.
* `ros_network_viz`.
* Message-flow analysis using `ros2_tracing` and Trace Compass to show messages moving between nodes over time. ([Open Robotics Discourse][14])

Kiwibot created `ros2_graph` because its delivery-robot stack had become too complex to maintain with screenshots from `rqt_graph`; it generates simplified Mermaid architecture documentation, including services and actions, directly from a running ROS 2 graph. ([Open Robotics Discourse][15])

The practical split is:

| Artifact                    | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| Functional architecture     | What the system is supposed to do              |
| Cyber-physical architecture | Where each function is deployed                |
| ROS graph                   | What nodes/topics/services actually exist      |
| Message-flow trace          | What executes, in what order, and for how long |

## 8. Validate complete graphs, not isolated model benchmarks

The ROS benchmarking discussions are unusually explicit about this.

The REP-2014 debate and RobotPerf discussions argue for:

* Testing individual nodes **and complete computational graphs**.
* Reproducible live, recorded, or synthetic input data.
* Output correctness checks.
* Configurable input sizes and publishing rates.
* Defined acceptable drop rates.
* Latency, throughput, power, and energy metrics.
* Tracing to locate internal bottlenecks after an external benchmark identifies failure. ([Open Robotics Discourse][16])

This is the decisive distinction:

> A detector achieving 60 FPS in isolation does not establish that the rover can run the detector, four camera pipelines, lidar odometry, dense reconstruction, recording, networking, and planning concurrently within the mission deadline.

## A particularly good Orin NX visualization: OmniNxt

OmniNxt is one of the few next-tier systems whose published material includes both a **system architecture diagram and resource-allocation/performance charts**.

Its workload includes:

* Four synchronized fisheye cameras at 20 Hz.
* A flight-controller IMU at 500 Hz.
* Omnidirectional VIO.
* Four virtual stereo depth pipelines.
* HITNET disparity inference.
* Real-time dense point-cloud generation.
* Navigation and planning.

The team intentionally replaced a more GPU-intensive feature matcher with Lucas–Kanade tracking to conserve GPU capacity. It then used four concurrent inference streams, FP16, and Tensor Cores to reduce the four-stereo-pair depth workload from approximately 200 ms to 62 ms, producing dense output at 15 Hz onboard the Orin NX. ([alphaXiv][17])

That is what a defensible NX selection looks like:

1. Sensor topology.
2. Functional graph.
3. Engine allocation.
4. Optimization choices.
5. Measured end-to-end processing time.
6. Remaining resource headroom.

## The concrete artifact set I would trust

For an Orin NX/AGX rover design, I would reject a proposal that contains only a block diagram and model-FPS table. The minimum credible package is:

1. **Objective tree and requirement matrix**
   Threshold, target, verification method, and criticality.

2. **Functional dataflow diagram**
   Every continuous and event-driven pipeline, including concurrency.

3. **Cyber-physical allocation diagram**
   Jetson, MCU, flight controller, sensors, storage, network, and safety systems.

4. **Interface/N² matrix**
   Data format, rate, size, bus, bandwidth, synchronization, and ownership.

5. **End-to-end timing diagram**
   Deadlines, jitter, queues, stale-data policy, and worst-case latency.

6. **Jetson engine/resource matrix**
   CPU, GPU, DLA, ISP, encoder, decoder, RAM, storage I/O, and power.

7. **Runtime ROS graph and trace**
   Actual nodes, topics, message causality, and scheduling behavior.

8. **Graph-level validation report**
   Reproducible inputs, correctness checks, drop rate, latency percentiles, memory peak, power, temperatures, and sustained-run stability.

That is the actual machinery by which a team establishes **“NX fits with margin”** or **“this crosses into AGX”**—not rover weight, camera count by itself, or advertised TOPS.

## Sources

[1]: https://apps.ep.jhu.edu/syllabus/spring-2026/645.767.83 "Spring 2026 Syllabus for 645.767.83"
[2]: https://coursecatalog.web.cmu.edu/schools-colleges/schoolofcomputerscience/robotics/ "Robotics Program — Carnegie Mellon University"
[3]: https://mrsdprojects.ri.cmu.edu/2026teama/design-documentation/ "System Design – VectorRobotics"
[4]: https://mrsdprojects.ri.cmu.edu/2023teamb/system-design/ "System Design – NightWalker"
[5]: https://websites.uta.edu/cseseniordesign/2025/12/08/igvc-f25/ "IGVC – CSE Senior Design"
[6]: https://mrsdprojects.ri.cmu.edu/2026teamf/system-design/ "System Design – FireSense"
[7]: https://forums.developer.nvidia.com/t/subject-hardware-advice-jetson-orin-nx-16gb-vs-agx-orin-64gb-for-triple-100-fps-video-processing/369423 "Hardware Advice: Jetson Orin NX (16GB) vs. AGX Orin (64GB) for Triple 100 FPS Video Processing"
[8]: https://pmc.ncbi.nlm.nih.gov/articles/PMC13074940/ "Design and Implementation of a Real-Time Visual Tracking System for UAVs Based on PSDK"
[9]: https://discuss.px4.io/t/time-sync-drift-between-jetson-and-pixhawk-using-micro-xrce-dds/47961 "Time-sync drift between Jetson and Pixhawk using micro-XRCE-DDS"
[10]: https://forums.developer.nvidia.com/t/planning-to-switch-orin-nano-to-orin-nx/354137 "Planning to switch orin nano to orin nx"
[11]: https://forums.developer.nvidia.com/t/jetson-orin-nx-maximum-concurrent-4-camera-isp-encode-and-decode-capability/372616 "Jetson Orin NX: Maximum concurrent 4-camera ISP, encode and decode capability"
[12]: https://forums.developer.nvidia.com/t/agx-orin-camera-experiencing-unexpected-frame-drops/366865 "AGX Orin Camera Experiencing Unexpected Frame Drops"
[13]: https://forums.developer.nvidia.com/t/how-to-use-dla-correctly/322765 "How to use DLA correctly?"
[14]: https://discourse.ros.org/t/ros-2-visualization-tools-for-architecture/41170 "ROS 2 Visualization Tools for Architecture"
[15]: https://discourse.ros.org/t/introducing-ros2_graph/29391 "Introducing ros2_graph"
[16]: https://discourse.ros.org/t/rep-2014-rfc-benchmarking-performance-in-ros-2/27770 "[REP-2014] RFC - Benchmarking performance in ROS 2"
[17]: https://www.alphaxiv.org/overview/2403.20085v1 "OmniNxt: A Fully Open-source and Compact Aerial Robot with Omnidirectional Visual Perception"
$b_compute_workload$,'content/datacore/compute-workload.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('artifact-intake','BEAST-01 Source Artifacts — Intake Register','research','Every source artifact verified by hash and opened: what each file actually is, what each image actually depicts, eleven anomalies where the filename lies about the contents, and five things the files cannot establish.',ARRAY['artifacts','beast','provenance','schematic']::text[],ARRAY['keyartifacts','hash','intake register','filename lies']::text[],NULL,'2026-07-27','/datacore/briefing/artifact-intake',$b_artifact_intake$# keyArtifactstosort — intake verification register

**Status:** VERIFIED SNAPSHOT — 2026-07-27, 05:22 local. Descriptive index only. Every entry below was
produced by opening the file and reading its contents, not by reading its name. No file in
`keyArtifactstosort/` was deleted, moved, renamed, re-compressed, or otherwise modified; git was not
touched.

## Why this exists

`keyArtifactstosort/` is a hand-collected staging folder guarded by its own `agents.md` ("DO NOT DELETE
FILES FROM HERE …"). Its filenames have proven unreliable — two PDFs named for different products are
byte-identical — so contents were verified independently of names. This register records what each file
actually is.

It lives in `keyArtifactstosort/` alongside the artifacts it describes (moved from
`docs/history/` on 2026-07-30 when the history graveyard was deleted). It follows the register
convention used by `docs/plans/*.md`: plain markdown, `**Status:**` line, dated facts.
The companion hash register is `reference/EVIDENCE-MANIFEST.md`.

**Scope limit.** This document describes artifacts. It does not assess what engineering questions any
artifact might answer; that analysis belongs to
`docs/plans/2026-07-30-wiring-model-completion.md`.

**This is a snapshot of a live folder.** It grew from 12 files to 23 during the verification run
(05:10 → 05:22 on 2026-07-27). Re-verify the count before relying on it.

Totals as measured 2026-07-27: **23 files, 65.98 MB.**

## Register

"Duplicate of" is checked against the other 22 files in the folder, `public/datacore/`, and branch
`data/hardware-cad-assets`. "Name accurate?" compares the filename to the verified contents.

### Documents

| File | Bytes | SHA-256 | What it is (verified) | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `agents.md` | 157 | `498e4bff61a32c3eb5b9a1514e26af6306f611b36a9725b5f21888203b74e929` | Plain text, one line: a preservation directive forbidding deletion from this folder | — | Yes |
| `linkToOldWSGIT.txt` | 39 | `888834ba2f5e727bcc88e0cab2600ceeff01fa0f4255e4ed2ac9cab6b0326152` | Plain text, one URL: `https://github.com/waveshareteam/ugv_ws` | — | Yes. Note the URL is the `ugv_ws` ROS 2 workspace repo, a different repo from the `ugv_jetson` snapshot recorded in the source-evidence manifest |
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | 1,023,807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | 1-page vector schematic, Altium Designer export, created 2024-02-24. Title block reads "waveshare / ROS Driver for Robots". Extracted text includes `MP8759GD`, `INA219BIDR`, `5V_Vout` | `UnclearMaybeforOrinDiagram.pdf` (same folder); `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`; LFS objects on the CAD branch | **NO.** Not a Raspberry-Pi-specific variant. It is the ROS Driver for Robots schematic |
| `UnclearMaybeforOrinDiagram.pdf` | 1,023,807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | Byte-identical to the row above — same 1-page ROS Driver for Robots schematic | Same set as above | **NO.** Not an Orin diagram |

### Archives

All seven archives open cleanly (`testzip` reports no bad entry), contain no encrypted entries, and are
neither empty nor password-protected.

| File | Bytes | SHA-256 | Verified contents | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | 272,014 | `cb7d51373314daa966dff26a30cb04d05adcf7c8d57e03341516f6b0f6e74259` | 1 entry: `UGV Beast_PI4B_AI_Kit.pdf`, 275,341 B. Fusion 360 Drawings export, 2384×1684 pt, dated 2024/4/3. **Title block reads "UGV Beast PT"**, author field "gu nian" | LFS object `cb7d5137…` at `assets/hardware/pi/` on the CAD branch; manifest row `beast-pi4b-3d` | **Partly.** The zip is a 2D dimension drawing, not a 3D model — "3D" is Waveshare's product-page label. Its internal title block also says PT, not PI4B |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | 11,096,497 | `b52f72922132568b8728d14c39c783edca1bb13bd1b5f0c694bde3e15c577f27` | 1 entry: `UGV Beast PI4B.step`, 97,519,128 B uncompressed | LFS object `b52f7292…`; manifest `beast-pi4b-step` | Yes |
| `UGV_Beast_PT_AI_Kit_3D.zip` | 307,341 | `33db3df8d1ad24a92a1a74ce0d5360ec78950fa421e48bc5e780acc76e038c9a` | 1 entry: `UGV Beast_PT_AI_Kit.pdf`, 311,424 B. Fusion 360 Drawings export, 2384×1684 pt, 2024/4/3, title block "UGV Beast PT", author "WaveShare". Dimension values differ from the PI4B drawing | LFS object `33db3df8…`; manifest `beast-pt-3d` | **Partly.** Same "3D" mislabel — contents are a 2D drawing |
| `UGV_Beast_PT_AI_Kit_step.zip` | 12,303,971 | `bf649936f7663c7e4520fe4e45aa02d0b5ae588e5c200229a1f2cbfdcd9b7631` | 1 entry: `UGV Beast PT.step`, 106,833,093 B uncompressed | LFS object `bf649936…`; manifest `beast-pt-step` | Yes |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 1,817,387 | `dbbeac8d878252ea0333ad6c2e96f3fd42d8fc03c65b3421c938c41deac31bf2` | 3 entries under `UGV Rover Jetson Orin ROS2 Kit_尺寸图纸/` ("dimension drawings"): a Fusion 360 PDF (721,879 B, 3370×2384 pt, 2024/10/25) and `UGV Rover PT Jetson Orin ROS2 Kit_DXF.dxf` (7,872,912 B; AutoCAD AC1027, extents 1189×841, `$LASTSAVEDBY` = "jaswalh") | LFS object `dbbeac8d…` at `assets/hardware/orin/` on the CAD branch. Not in the manifest | Yes for "2D". **Note it is a UGV *Rover* kit, not UGV *Beast*** |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | 16,007,240 | `eaa50ebdd9a648da45f1b0b54321167efa6540411a908e44e8c80d40e33b01ff` | 1 entry: `UGV Rover PT Jetson Orin ROS2 Kit v2.step`, 105,536,920 B uncompressed | LFS object `eaa50ebd…`. Not in the manifest | Yes. **UGV *Rover*, not Beast** |
| `UGV_RoverFACTORY-260706.zip` | 22,722,509 | `b7ec5600d45c181c1f6985b612956fa98f40aa8dda6274f3520e2af14a15e1ae` | 62 entries — an Espressif `flash_download_tool_3.9.5` distribution with a Waveshare ESP32 payload preloaded. Detail below | No duplicate anywhere in the repo | Yes, with the caveat that entry timestamps run 2023-06-12 → 2026-07-06, so `260706` matches the newest entry, not the whole contents |

#### `UGV_RoverFACTORY-260706.zip` contents

Single top-level folder `UGV_RoverFACTORY-260706/`, then
`flash_download_tool_3.9.5/flash_download_tool_3.9.5/`. File types present: 8 `.bin`, 5 `.bin_rep`,
15 `.txt`, 8 `.conf`, 2 `.pdf`, 1 `.exe`. Uncompressed total 24,851,816 B.

| Member | Bytes | SHA-256 (first 16) | What it is |
|---|---:|---|---|
| `bin/ROS_Driver.ino.bin` | 1,240,320 | `dc800e0a16bc783d` | ESP32 application image. Embedded strings include `UGV Beast`, `UGV Rover`, `ugv_base_ros.git`, ESP-IDF `v5.1.4-972-g632e0c2a9f-dirty`, compile date `May 8 2026` |
| `bin/ROS_Driver.ino.bootloader.bin` | 24,896 | `b22f373e6194a625` | ESP32 bootloader |
| `bin/ROS_Driver.ino.partitions.bin` | 3,072 | `148b959cbff1c38a` | Partition table |
| `bin/boot_app0.bin` | 8,192 | `f94c5d786a7a8fab` | OTA boot selector |
| `dl_temp/bin_tmp/downloadPanel1/ROS_Driver.ino.bin` | 1,238,928 | `c2fd02f59a5945ad` | **A second, different application image** — compile date `Aug 27 2025`, entry timestamp 2025-09-03 |
| `combine/target.bin` | 896,192 | `3d5a7534c7c700f8` | Merged image; embedded build dates 2020–2021, entry timestamp 2023-07-29 |
| `configure/esp32/multi_download.conf` | 2,109 | — | Flash offsets: `0x1000` bootloader, `0x8000` partitions, `0xe000` boot_app0, `0x10000` application |
| `doc/Flash_Download_Tool__en.pdf` / `__cn.pdf` | 797,366 / 844,590 | — | Espressif tool manuals, EN and CN |
| `doc/release_note.txt` | 333 | — | Espressif tool changelog, versions 3.9.2–3.9.5 |
| `flash_download_tool_3.9.5.exe` | 19,636,965 | — | Third-party Espressif Windows executable — 86% of the archive by size |
| `logs/*.txt` (12 files) | 1,078–8,657 | — | Flashing session logs containing ESP32 MAC addresses; timestamps 2023-07-29 |
| `dl_temp/_temp_by_dltool/…` (4 `.bin_rep`) | 17,104–24,896 | — | Tool scratch copies, incl. one named `RoArm-M2_example.ino.bootloader.bin_rep` (a different Waveshare product) |

### Images

None of these is a photograph of the owner's own hardware; all are Waveshare-authored renders, product
diagrams, or web-page captures.

| File | Bytes | SHA-256 | What it is (verified) | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `audioDriverBoard.png` | 289,977 | `41a857270dc3141a83b9522341bc58aef0af24212e9159a2a95e71fed17cf999` | 847×637 PNG, page capture on white. Product diagram: front and back faces of a PCB silkscreened "RPI Audio HAT for Robots", numbered leader lines 1–10, with a printed two-column legend below naming each callout. Rendered text, not photographic | No byte-duplicate. Same underlying diagram as `UGV-Beast-details-83.jpg` at different size and crop | Yes |
| `UGV-Beast-details-83.jpg` | 107,714 | `86641ec51ac8e3c9aebd98e6bda3b9d709b874303bd62ebd3524ec8719239416` | 960×~490 JPEG. The same front/back "RPI Audio HAT for Robots" diagram with numbered leaders 1–10. **Legend text is absent**; the board renders larger | Not byte-identical to `audioDriverBoard.png` | Opaque but not wrong — a Waveshare gallery index number |
| `correctbutincompleteimageofaudioBoard.jpg` | 160,720 | `b0be81522217b00fd15b07bda8049423c6ecaa701c35b25a54f4bb2e3c153b2c` | 960×750 JPEG marketing composite. Greyscale chassis render with a small PCB and two black box enclosures picked out in colour; leader labels "Onboard Microphone", "3.5mm Audio Jack", "Dual-track Speaker", "Audio Driver Board". Two insets: a photo of a gold/black speaker, and a screenshot of a text-to-speech input box. Board connectors on the far edge are not legible | — | Yes. Owner's "incomplete" qualifier matches what is visible |
| `rawDriverBoardshot.jpg` | 160,296 | `0cb3bac7bf88511cdcb4795949381d640890aac3bb1357a6c2ce679b2618acff` | 960×520 JPEG. Product diagram: front and back faces of the "ROS Driver for Robots" board, numbered leader lines 1–19, no legend text. Silkscreen legible at full size (`USB`, `LIDAR`, `IIC`, `IO4`, `IO5`) | Not byte-identical, but the same diagram as `public/datacore/beast-driver-board-callouts.png` (926×742 PNG, 4-channel). This JPEG is smaller and lossy | **Partly.** "raw…shot" implies a photograph; it is a rendered diagram |
| `UGV-Beast-details-size-1.jpg` | 352,019 | `6e557aea09b70c61e63afcf75445d93f6812390723b4270026a8283e7458d341` | 960×2477 JPEG. Dimensioned three-view engineering drawing (front, side, top) of the tracked robot, blue dimension lines and figures. Header "UGV Beast PT PI4B AI Kit / UGV Beast PT PI5 AI Kit", footer "Unit: mm". Values include 230.42, 231.46, 231.54, 251.78, 159.96, 156.22, 132.59, 120.88, 91.25, 85.80 | — | Yes — "size" is accurate |
| `imageShowingRaspberryPIInvertedandconnectedOnTop(justshowsraspberrypis).png` | 365,244 | `7a04ff3df38d9d97d922b5a4802625f2067b5fb7d9d4e7567c9d406c9d54f37d` | 812×615 PNG page capture headed "Based On Raspberry Pi". Two renders captioned "Connecting with Raspberry Pi 4B" and "Connecting with Raspberry Pi 5"; each shows a green single-board computer mounted solder-side-up on standoffs above a dark chassis, its USB-A and Ethernet connectors facing outward and unoccupied. A dark 2×20 connector body is visible beneath the board's left edge | — | Yes — it does show Pi boards and the parenthetical caveat is accurate |
| `imagesortofshowingthe stackandhowitworksforraspberrypi.png` (note the space in the filename) | 530,653 | `68ee10c2372f95a1c7fd2eb45cb7b2261dcab4e7273fc9395343b72f1f746942` | 866×796 PNG page capture. Heading text about a Raspberry Pi host controller and an ESP32 sub-controller, a greyscale robot render with two blue pointer arrows, product photos labelled "Host controller: Raspberry Pi 4B/Pi 5" and "Sub controller: ESP32", each with a bulleted capability list | — | Yes, including the "sort of" hedge |
| `imageoftopcutoutsandfrontcutouts(cleannothingmounted).png` | 102,049 | `a2283d14716adc7c3e169c373ec8b6ae22f70d7349b55f1d3b11bee9abaadcfe` | 806×390 PNG. Two black-on-white outline drawings of flat sheet-metal parts: a large plate with slots, round holes and a square four-hole pattern, and a narrow bracket. No dimensions, no title block, no annotation | Not byte-identical, but is the same pair of drawings that appears as the lower half of `UGV-Beast-details-25.jpg` | Yes |
| `UGV-Beast-details-25.jpg` | 179,211 | `f9b4f278a615767f5898b24aa878611ee28781b6a957d9c2ae799a9e98fb81fa` | 960×1300 JPEG. Render of the tracked robot with leader labels "LIDAR" and "Camera", above the same two outline part drawings. Footnote: "The Lidar is NOT included in the package. Please refer to the part list for detailed package content." | Superset of `imageoftopcutoutsandfrontcutouts…png` | Opaque but not wrong |
| `UGV-Beast-details-73.jpg` | 155,812 | `6ce43872997f7687430c3844fe64a0d0b47056b559bf61dbe75494e4ebf9d51e` | 960×638 JPEG. Dark render looking down into the chassis between the tracks, with a green wireframe rectangular box overlaid on an interior volume. No text, no dimensions | — | Opaque but not wrong |
| `possiblebatteryexpansion.jpg` | 42,079 | `c93e0152ec6cbe2729d3688b7796106f04467e60ec2386ff991384e97c817276` | 420×394 JPEG. Small render: a blue multi-cell cylindrical battery pack sitting on the robot's top deck, rest of the chassis ghosted grey, a black lead routed off the deck edge. No text or labels | — | Descriptive of the subject; "possible" is the owner's own hedge |
| `threeQuarterImageofBeastwithuselessmarkup.jpg` | 164,099 | `fa43d0a0fe8491abb9876bc8e47def432887a5147b12be4aeb0b776b1a5d2880` | 960×760 JPEG. Three-quarter render of the robot with two blue leader labels, "Antenna connector" and "4G/5G Module\*", and a dashed rectangle outlining an area of the top deck | — | **Partly.** The three-quarter framing is accurate; the markup is present and legible, so "useless" is a judgement the image does not bear out |

## Duplicates

Checked by SHA-256 across all 23 files, `public/datacore/`, `public/datacore/pdfs/`, and the nine LFS
pointers on `data/hardware-cad-assets`.

**Inside the folder — exactly one byte-identical pair:**

- `RasperryPIversionofROS_Driver_for_Robots.pdf` == `UnclearMaybeforOrinDiagram.pdf` (`b8ccd10f…`)

All 21 other files are mutually distinct. In particular, **`UGV_Beast_PI4B_*` and `UGV_Beast_PT_*` are
genuinely different content**, not the same kit twice — distinct hashes for both the `_3D` and `_step`
pairs, and the two enclosed drawings carry different dimension values and different author fields.

**Against the repo — eight files are already present elsewhere, byte-for-byte:**

| Folder file | Also exists as |
|---|---|
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`; LFS oid `b8ccd10f…` |
| `UnclearMaybeforOrinDiagram.pdf` | same object as above |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | LFS oid `cb7d5137…`, `assets/hardware/pi/` |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | LFS oid `b52f7292…`, `assets/hardware/pi/` |
| `UGV_Beast_PT_AI_Kit_3D.zip` | LFS oid `33db3df8…`, `assets/hardware/pi/` |
| `UGV_Beast_PT_AI_Kit_step.zip` | LFS oid `bf649936…`, `assets/hardware/pi/` |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | LFS oid `dbbeac8d…`, `assets/hardware/orin/` |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | LFS oid `eaa50ebd…`, `assets/hardware/orin/` |

The six CAD zip hashes additionally match the upstream hashes recorded in
`reference/EVIDENCE-MANIFEST.md` (rows `beast-pi4b-3d`, `beast-pi4b-step`,
`beast-pt-3d`, `beast-pt-step`) or, for the two Rover Orin zips, appear on the CAD branch without a
manifest row.

**Near-duplicates, not byte-identical** — same underlying artwork at different size, crop, or format:

| Pair | Relationship |
|---|---|
| `audioDriverBoard.png` ↔ `UGV-Beast-details-83.jpg` | Same Audio HAT diagram. The PNG carries the legend text; the JPEG has a larger board and no legend |
| `rawDriverBoardshot.jpg` ↔ `public/datacore/beast-driver-board-callouts.png` | Same driver-board diagram. The repo copy is 926×742 PNG with alpha; the folder copy is 960×520 lossy JPEG |
| `imageoftopcutoutsandfrontcutouts…png` ↔ `UGV-Beast-details-25.jpg` | The PNG is the lower portion of the JPEG |

**Redundancy note.** Of the 23 files, eight are exact duplicates of bytes already stored in the repo and
three more are lower-fidelity or cropped variants of another file present here or in `public/datacore/`.
Within `UGV_RoverFACTORY-260706.zip`, `flash_download_tool_3.9.5.exe` (19.6 MB, 86% of the archive) is a
redownloadable third-party Espressif binary, and `dl_temp/` and `combine/` hold tool scratch copies. If
the folder is ever pruned, those are the candidates; nothing in this register is unique-and-at-risk
except the factory archive's `bin/`, `configure/`, and `logs/` members and the eleven images.

## Anomalies

1. **Both PDFs are misnamed.** Neither is a Raspberry-Pi variant nor an Orin diagram; both are the ROS
   Driver for Robots schematic (title block "waveshare / ROS Driver for Robots", Altium export,
   2024-02-24), byte-identical to each other and to `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`.
2. **`data/hardware-cad-assets` carries two differently-named LFS pointers with the same oid.**
   `assets/hardware/pi/DriverBoardsRaspberryPiBeast.pdf` and
   `assets/hardware/orin/DriverBoardBeastOrin.pdf` both point at `b8ccd10f…`. This is stated here as a
   duplicate fact only. It is worth noting that `reference-data.ts` `INTEGRITY_NOTE` describes this as
   having "lost the ROS Driver original", whereas the manifest's independently recorded upstream hash
   for `ros-driver-schematic` is also `b8ccd10f…`. Resolving that wording is out of scope for this index.
3. **`UGV_Beast_PI4B_AI_Kit_3D.zip` contains a drawing whose title block reads "UGV Beast PT"**, not
   PI4B, with author field "gu nian" rather than "WaveShare". The drawing content is nonetheless
   distinct from the PT zip's. This is an upstream labelling inconsistency, not a duplicate.
4. **Both `_3D.zip` archives contain 2D drawings, not 3D models.** The actual 3D geometry is in the
   separate `_step.zip` archives. "3D" is Waveshare's product-page label.
5. **Both Orin archives are UGV *Rover* kits**, not UGV *Beast*. The Beast-specific Orin CAD
   (`UGV_Beast_PT_Jetson_Orin-3D.zip`, oid `56615c77…`, 15,378,700 B) exists on the CAD branch and in the
   manifest but **is absent from this folder**.
6. **`UGV_RoverFACTORY-260706.zip` contains two different ESP32 application images** — `bin/` holds a
   2026-05-08 build (`dc800e0a…`), `dl_temp/` a 2025-08-27 build (`c2fd02f5…`). "The firmware" is
   therefore ambiguous without specifying which.
7. **The same archive contains a 19.6 MB third-party Espressif `.exe`** and 12 flashing logs holding
   ESP32 MAC addresses from 2023-07-29 factory sessions.
8. **`threeQuarterImageofBeastwithuselessmarkup.jpg` has legible, substantive markup** ("Antenna
   connector", "4G/5G Module\*", dashed deck outline). The filename's "useless" is not borne out.
9. **`rawDriverBoardshot.jpg` is not a photograph** despite "shot" in the name — it is a rendered
   product diagram.
10. **One archive uses non-ASCII internal paths** (`…_尺寸图纸/`, "dimension drawings"). Harmless, but it
    breaks naive extraction tooling under Windows default code pages; this was encountered and worked
    around during verification.
11. **The folder is live.** It grew 12 → 23 files during the 12 minutes of this verification run. Any
    count here is a snapshot.

## Safe interim copy

A verified copy was taken on 2026-07-27 to a location outside the repo working tree:

```
D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\
```

23 files, 65.98 MB, **all 23 SHA-256 values verified identical to source**. The source folder was
unmodified by the copy (newest write time unchanged at 05:22:06). This is a plain copy on the same
physical volume — it guards against accidental deletion, not against drive failure. It is not a backup.

## Not determined

- **Download provenance for the two identical PDFs.** No source URL was captured with either file, so
  whether Waveshare publishes one schematic under two product links, or the same link was followed
  twice, cannot be distinguished from the files alone.
- **Upstream URLs for the two Rover Orin zips and for the factory archive.** None appear in
  `reference/EVIDENCE-MANIFEST.md`, and the archives carry no source metadata.
- **Whether a distinct Pi-specific or Orin-specific driver-board schematic exists upstream at all.**
  Not resolved: `waveshare.com/wiki` returns HTTP 403 to automated fetches, so the kit pages' download
  lists could not be enumerated.
- **How `UGV_RoverFACTORY-260706.zip` was obtained.** The 2023-07-29 production logs suggest a
  Waveshare factory workstation origin, but nothing in the archive states it.
- **Why the Beast-specific Orin CAD is absent** from this folder while its Rover counterparts are
  present.

## Pruning applied — 2026-07-27

Verified against the hash-checked backup at
`D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\` (all 23 files confirmed
hash-identical) **before** any removal. Rationale and fetch instructions are in
[the Hardware Library CAD section](../docs/hardware-library.md).

| Removed | Recoverable from |
| --- | --- |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_3D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_step.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | `data/hardware-cad-assets` (LFS) |
| `flash_download_tool_3.9.5.exe`, from inside `UGV_RoverFACTORY-260706.zip` | Espressif, freely published |

The removed executable was Espressif's flash download tool, version 3.9.5, 19,636,965 bytes,
SHA-256 `146db73596dda2865e409a611e1f31737cf1feac3817fd4ebd619f8e97b9c273`. The factory archive was
repacked with the other 61 entries intact and shrank from 22,722,509 to 3,631,566 bytes.

**Retained deliberately:** both ESP32 application images (`bin/` 2026-05-08 and `dl_temp/`
2025-08-27 — they differ, and one is likely what runs on BEAST-01 today), the release notes, all
flashing logs, both PDFs (byte-identical to a repo file, so they cost no additional stored bytes,
and they preserve the record of what was downloaded under those misleading names), and every image.

Folder went from 23 files / 65.98 MB to 17 files / 8.0 MB.
$b_artifact_intake$,'keyArtifactstosort/INTAKE-REGISTER.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('wiring-model-completion','Finish the Wiring Model — One Spine, Two Eyes','plan','The single wiring work order: close the half-fed spine so The Board and the console project from wiring.ts, extract the corpus (schematics, firmware, photos, CAD), land facts with zone citations, and put operator-critical answers on screen.',ARRAY['architecture','wiring','beast','schematic','cad']::text[],ARRAY['join key','the board','wiring spine','netlist','grain','x1']::text[],NULL,'2026-07-30','/datacore/briefing/wiring-model-completion',$b_wiring_model_completion$# Finish the wiring model — one spine, two eyes

**Status:** ACTIVE — 2026-07-30. Supersedes and merges
`2026-07-27-architecture-unification.md` (half-executed) and
`2026-07-27-schematic-netlist-extraction-plan.md` (barely started), which were two dependent
halves of one pipeline. The CAD exploration tasks (X1–X6) from
`2026-07-27-cad-assets-usage-and-discoverability.md` are folded in as Phase 2b; that document's
reference half now lives in `docs/hardware-library.md`.

**This plan does not merge The Board and the BEAST Console.** Both views stay — they are
different eyes on the same robot. What unites is the data underneath, so a fact learned once is
written once and appears in both.

## Done condition

All five:

1. A newly learned hardware fact is added in **one** place, and both views reflect it. Divergence
   is not representable, not merely detected.
2. Every cable and rail on the assembled robot is represented with provenance appropriate to the
   claim: document-derived claims name a sheet zone or image region; as-built claims name the
   observation or measurement.
3. The twin view and the console view agree everywhere they overlap; updating one without the
   other fails CI **by name**.
4. Every `reference-data.ts` `OPEN_ITEMS` entry is closed with a recorded method or restated as
   genuinely unanswerable from what we hold.
5. Operator-critical material — the vacated Pi dock orientation, 40-pin numbering, which USB-C is
   which — is **on screen**, not only in markdown. Work that does not reach the screen is not
   finished (North Star G4).

---

## Where things stand (verified 2026-07-30)

Landed and tested — do not redo:

| Landed | Where |
| --- | --- |
| 29-cable loom on a shared surface, with `parentNet` references | `src/data/wiring.ts` |
| `Build` / `PortCategory` in the spine | `src/data/types.ts` |
| Console derives its loom (`EXPECTED_CABLES` projects from `WIRING_LINKS`) | `bench-data.ts` |
| Wiring integrity suite (projection fidelity, label join, orphan count = 7) | `src/__tests__/wiring.test.ts` |
| Twin Type-C bridges corrected CP2102 → CH343P; callouts 6/7 identified | `hangar.ts` |
| Traced connectivity extraction: 108 path edges, JSON + CSV + MD | `keyArtifactstosort/Artifacts/ros-driver/current/ros_driver_traced_connectivity_v1/` |

**The half-fed state (closed 2026-07-30):** Phase 1 landed — `MODULE_NETS` + `WIRING_LINKS`
live in `src/data/wiring.ts`; `hangarData.nets` is a reference to `MODULE_NETS`; Live Plug draws
`WIRING_LINKS` directly (no `CableDef` copy). Overlap aliases + CI in `wiring.test.ts`.

**Already answered but not yet in the app:** the traced connectivity artifact answers Q1 — the
host-header 5 V is on post-M2 `5V_MAIN`. It lives in the artifact store in a format no plan
specified; Phase 3 lands it as `internal`-grain nets.

---

## Phase 1 — Spine: The Board consumes the wiring surface — DONE 2026-07-30

- **Input:** `src/lib/twin.ts`, `src/data/wiring.ts`, `hangar.ts` `nets[]`.
- **Done:** `grain` on `Net`; `MODULE_NETS` + `netsAtGrain`; Board via `hangarData.nets === MODULE_NETS`;
  Console via `EXPECTED_CABLES` re-export of `WIRING_LINKS`; `BENCH_TERMINAL_ALIAS` + overlap tests.

## Phase 2 — Extract the corpus

Safe to run unattended. T1/T2 are cheap and unblock the rest. Source roles: schematic = depicted
electrical connectivity; firmware source = intended GPIO for that revision; compiled image =
behavior encoded in that build (not proof it is flashed); callout diagram = vendor connector
identity (outranks the schematic for *physical identification*); photograph = as-built state at
capture time; observation = recorded test state only.

- **T1 — Tile the schematics.** Render the board PDFs (`public/datacore/pdfs/`) at high DPI, cut
  along each sheet's own printed zones. Emit `public/datacore/tiles/<board>/<zone>.png` +
  `index.json` (zone → PDF bbox). Verify legibility on M2/Q1/Q2 and the D1/D2/AMS1117 junction —
  a wrong magnification there already produced one wrong power claim.
- **T2 — Mine the firmware.** `strings`-diff both ESP32 images in `UGV_RoverFACTORY-260706.zip`;
  read pin definitions and command dispatch from `github.com/waveshareteam/ugv_ws` source. Emit
  a GPIO-to-function table and JSON command vocabulary into `docs/beast-ops.md`. Answers several
  OPEN_ITEMS for the cost of a clone — do early.
- **T3 — Read the photographs** (`keyArtifactstosort/`, priority: the vacated Pi dock image —
  highest safety value — then the Audio HAT pair, stack geometry, raw driver board). Distinguish
  *read from image* from *inferred*; "too low resolution" is a useful result. Non-wiring
  hardware facts go to `docs/hardware-library.md`.
- **T4 — Driver-board netlist.** From T1 tiles, dump text spans + vector paths (PyMuPDF), no
  interpretation; propose connections by proximity, confirm visually. Intermediate working data
  only, with the source PDF's SHA-256 recorded (these PDFs were silently corrupted by LFS
  dedup once). Review anomalies (single-member nets, unmatched labels/geometry, zone-spanning
  nets); **zero anomalies on a sheet this dense gets a deliberate second review.** Note: the
  off-spec `ros_driver_traced_connectivity_v1` artifact already covers much of this — consume it
  before re-deriving.
- **T5 — Diff ROS Driver vs General Driver.** Every place the repo cites General Driver guidance
  for a ROS Driver fact (possibly including the 65×65 / 49×58 mounting figures) is confirmed
  transferable or flagged.

### Phase 2b — CAD geometry (X1 gates drilling — run it before anything touches mounting)

Archives live on the `data/hardware-cad-assets` LFS branch; locations, fetch commands, and the
three verified filename traps are in `docs/hardware-library.md`. Do not trust filenames.

| # | Task | Why / output |
| --- | --- | --- |
| **X1** | Extract `UGV_Beast_PT_Jetson_Orin-3D.zip`; determine if it holds the host-bay plate with the Jetson hole pattern. | NVIDIA gates the P3768 hole XY behind a login; `MOUNT_LAYERS` currently says drill-and-hope. **Gates a physical, irreversible operation.** |
| **X2** | Extract driver-board outline + hole spacing from Beast STEP; compare 65×65 / 49×58. | Confirms or corrects `MOUNT_LAYERS`; retires the calipers caveat (= Q8). |
| **X3** | Extract mast + Picatinny rail geometry; check Mid-360S and OAK-D Pro fit and FOV clearance. | Mount feasibility for the future loadout. |
| **X4** | Diff PI4B vs PT drawing dimension sets. | Settles which archive applies to BEAST-01. |
| **X5** | Establish whether a Beast-specific Orin 2D drawing exists upstream. | Blocked: Waveshare wiki 403s automated fetches — needs a human browser. |
| **X6** | Assess STEP → mesh → URDF feasibility and cost. | Go/no-go for a dimensionally accurate robot description (TF, Nav2 collision). |

## Phase 3 — Land the facts in the model

- **Do:** consume T2–T5 and the traced-connectivity artifact into the wiring model. Only
  `visible` / `visually-traced` claims become `internal`-grain nets; `ambiguous` /
  `not-determinable` become `OPEN_ITEMS` entries, never silent omissions. Carry zone-level
  citations (`doc-ros-driver#C6`, not a bare 1 MB PDF). Re-evaluate the current claims about
  connector 6, the D500 route, and the Orin DC input against scoped sources; retain, revise, or
  flag each.
- **Conflicts:** never resolve a source disagreement by editing one side to match. Record both
  claims and escalate to `OPEN_ITEMS` naming both.
- **Done when:** Q1 is answerable on screen with a zone citation; integrity tests pass; no net
  cites a bare PDF where a zone exists.

## Phase 4 — On screen

- **Reconcile the views (W3 + T7):** state the line between **installed** (loadout slot filled)
  and **cabled** (which wire runs where). `WiringDiagram.tsx` currently makes wiring claims from
  five hardcoded SVG paths gated on loadout state; `DriverBoardSchematic` joins on a
  human-readable label (test-pinned). Bring them onto the wiring surface or document them as
  loadout-only views. Then assert the twin/console overlap pairs agree (`gdb-usb-esp32` ↔
  `drv-esp32-usb`, `orin-dc-in` ↔ `jet-barrel`, `net-d500-lidar` ↔ HAT lidar route,
  `net-5v-host` ↔ `drv-5v`) — divergence fails CI by name.
- **Operator-critical (T8):** the vacated Pi dock orientation and 40-pin numbering on screen —
  that is where a mistake puts 5 V into a Jetson UART pin. Zone tiles become the citation target
  when inspecting a net. Done when "where do the UART jumpers go" is answerable from the running
  app.
- **Derived views (T9):** generate a Mermaid power tree from the settled model (renders natively
  here and on GitHub); optionally SPICE as a portability escape hatch. Unverified relationships
  render visually distinctly or not at all.

## Phase 5 — Hygiene

- **W2 — Close the 7 orphan strands** (`orphanLinks()`: speaker, spotlight, ESP32 antenna, HAT
  USB uplink on both builds, Jetson Wi-Fi, Mid-360S Ethernet). Each gets its module-grain trunk
  or a recorded reason. Count is pinned in `wiring.test.ts`; lowering it is a deliberate edit.
- **W5 — Resolve the dead Postgres twin tables.** Migration `2026-07-03-connected-twin.sql`
  created `terminals`/`nets`/`net_terminals`/`documents`/`net_documents`; the seed emits rows;
  nothing reads them. Add a nets/terminals repository following `src/server/hangar/items.ts` +
  `readWithStaticFallback`, or record in `db/hangar/standup.md` that they are seeded-but-unread
  by design, with the reason. Recommended: the former — the pattern exists and the seed is
  already generated.
- **W6 — Rewrite the AGENTS.md content workflow** (the operator's `REWRITE THIS` note). After
  Phase 1, "ingest directly into `hangar.ts`" is incomplete: wiring facts land in `wiring.ts`,
  briefings are records in `datacore-briefings.ts` pointing at markdown that stays where it was
  authored. Done when an agent following that section alone puts a new fact in the right place.

---

## Questions to close

Live entries in `reference-data.ts` `OPEN_ITEMS`. When one closes, update it in the same change.

| # | Question | Answerable by | Priority |
| --- | --- | --- | --- |
| Q1 | Which 5 V net reaches the 40-pin header — pre- or post-M2? | **Answered in artifact** (post-M2 `5V_MAIN`); Phase 3 lands it, observation confirms | Blocking — the claim once asserted without tracing |
| Q2 | 40-pin numbering on the HAT's vacated dock | T2 + T3 + T4 | **Blocking, safety-critical** — wrong numbering puts 5 V into a Jetson UART pin |
| Q3 | M2 gate topology (Q1/Q2 MMBT3906, R18 100K / R19 470K) | T4 | High |
| Q4 | Is `3V3_OP` the same net as `3V3`? | T4 | Medium |
| Q5 | What supplies the bus servo rail? | T4 + `Bus_servo_control_circuit.pdf` | Medium |
| Q6 | Audio HAT USB uplink route | T3 only; **no HAT schematic exists** — may be undecidable from documents | High |
| Q7 | Does a spare 40-pin header (callout 14) exist on the assembled board? | T3 + physical look — likely two footprints, one bus | Medium |
| Q8 | Are 65×65 / 49×58 valid for the ROS Driver or inherited from the General Driver? | T5 or X2 | Medium — precedes drilling |

## What no document can answer

Prefer the least invasive method. First operational observation (narrows Q1, no instrument):
Jetson on mains barrel, battery pack **off**, USB in driver-board connector 6 — fan spins /
codec+hub in `lsusb` / D500 as serial device each establish what was powered and reachable in
that test state. Record as `method: "observation"` with the configuration. Two metering cases:
disambiguating a negative (probe pin 2 → pin 6: ≈0 V vs ≈4.5–5 V separates dead rail from dead
fan); and **before inserting any conductor into a socket whose pinout is inferred (Q2)** —
identify the 5 V holes with a meter, mark them, power down, re-check orientation. Also capture a
baseline of the driver board's rails while the robot is in a known state.

Real gaps: no Audio HAT schematic in holdings (searches so far found none; continuity testing is
the follow-up if Q6 survives T3); Waveshare wiki 403s automated fetches; NVIDIA's P3768 hole
coordinates are login-walled (X1 is the other route).

---

## Rules for whoever picks this up

- **A wiring fact is a net.** Pick the grain, write one record, cite the zone or image region.
- **Layout coordinates are not facts.** They live with the view that draws them.
- **Intra-board rails are not top-level nets.** They are `internal` grain or OPEN_ITEMS answers —
  hundreds of internal nodes would destroy the model's usefulness.
- **Source precedence:** firmware source > schematic > vendor callout diagram > wiki > inference —
  except physical identification, where the callout diagram outranks the schematic.
- **New views are new projections, not new stores.** A third eye is welcome; a third copy is not.
- Phases 1, 3, 4 change shipped data: run `task check` (lint + typecheck + tests + build) before
  committing.
- Findings go into owner docs (`docs/beast-ops.md`, `docs/hardware-library.md`,
  `db/hangar/standup.md`), into `OPEN_ITEMS`, or on screen — not into new docs.
- Nothing in `keyArtifactstosort/` may be deleted — see `keyArtifactstosort/agents.md`. Copy and
  extract freely.
$b_wiring_model_completion$,'docs/plans/2026-07-30-wiring-model-completion.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('cad-assets','CAD Assets — Where They Live and What They Are For','plan','Hardware Library hosting: Garage hangar-library + Hangar proxy Open links, N5 off-cluster mirror, CAD naming traps, and the library-manifest existence register. The X1–X6 exploration work moved into the wiring-model plan.',ARRAY['cad','beast','mounting','jetson']::text[],ARRAY['step','stl','mounting pattern','x1']::text[],NULL,'2026-07-27','/datacore/briefing/cad-assets',$b_cad_assets$# Hardware Library

The source-of-truth CAD, schematics, datasheets, firmware, and captured wiki pages for the
UGV Beast — surfaced in-app as the **Hardware Library** tab of Datacore (`/datacore`), and the
place to look when you need the real board/mechanical reference while designing. The catalog is
data; the bytes live outside the repo. Verify against `src/` before relying on anything here.

## What it is

- **In-app surface:** `/datacore` → **Hardware Library** tab. Documents are grouped by subsystem
  (Driver Board, Power/UPS, Servos, Chassis CAD, Jetson Orin, Code/Firmware, Wiki). Each card
  links to a detail page `/datacore/<docId>`.
- **Interactive driver-board pinout explorer:** the driver-board schematic doc
  (`/datacore/doc-gdb-schematic`) embeds an animated board map — click a port to see what the
  Beast has slotted there. It reads the live `beast` loadout, mirroring the rover schematic.
- **Connected-twin evidence:** a document's detail page lists the wiring `nets[]` that cite it as
  proof, so a schematic is one click from the connections it explains.

## Where the data lives (catalog)

- **Records:** `src/data/hangar.ts` → `documents[]`, typed by `DocumentRef` in
  `src/data/types.ts` (`kind`: schematic | manual | cad | firmware | wiki | datasheet | image).
- **Stable key:** each record's `libraryPath` is a path under `beast/<NN-Subsystem>/…`.
  `hangar-integrity.test.ts` enforces the `beast/` prefix; the UI derives the
  subsystem grouping from the `<NN-Subsystem>` folder, so the numeric prefix sets the order.

## Where the bytes live (hosting)

The binaries are **not** in the repo or the container image.

- **Primary runtime store:** Garage bucket `hangar-library` (ClusterIP-only). Hangar proxies
  downloads at `GET /api/hangar/library/<key>` so browsers never talk to S3.
- **Open links:** `DATACORE_LIBRARY_URL=https://hangar.moosegoose.xyz/api/hangar/library`
  (server-side env on the Hangar Deployment; see `docs/deploy.md`).
- **Object keys:** `libraryPath` with the `beast/` prefix stripped
  (e.g. `05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip`).
- **Existence register:** `db/hangar/library-manifest.json` (SHA256, bytes, source, uploaded_at).
  Rebuild/upload with `doppler run --project homelab --config dev -- npx tsx db/hangar/upload-library.ts`
  against a Garage port-forward (`kubectl -n garage port-forward svc/garage 3900:3900`).
- **Off-cluster mirror (required durability):** N5 ZFS
  `/tank/dev-archive/hangar-library/` (layout matches object keys). Snapshot
  `tank/dev-archive@hangar-library-2026-08-10`. Garage-on-Longhorn is not independent DR.

- **Deliberately not `NEXT_PUBLIC_*`.** A `NEXT_PUBLIC_` var is string-inlined into the client
  bundle at `next build` time — the cluster could never set it after the image is built without a
  rebuild. `DATACORE_LIBRARY_URL` is instead read server-side at request time in
  `src/app/layout.tsx` (which is `force-dynamic`) and threaded through `HangarProvider` into the
  store as `libraryBaseUrl`, so the cluster can set/change it as an ordinary Deployment env var —
  no rebuild required.
- The app resolves a document to a URL at render time: `resolveDocumentUrl(doc, libraryBaseUrl)` in
  `src/lib/documents.ts` returns an explicit `url` if set, else `${libraryBaseUrl}/` + the
  library-relative key.
- **Offline-safe when unset:** when `DATACORE_LIBRARY_URL` is unset, the catalog stays fully
  browsable and open links show "library offline" — never a broken link. There is currently no
  reachability probe: if the var is set but the store is actually unreachable, "Open" still
  renders a link, which may 404/time out when clicked.

## Adding a document

1. Copy the file into the library store under the right subsystem folder, keeping the
   `<NN-Subsystem>/` layout.
2. Add a `DocumentRef` to `documents[]` in `src/data/hangar.ts` with a matching
   `libraryPath: 'beast/<NN-Subsystem>/<file>'`, its `kind`, and related `units`.
3. If the file proves a wiring connection, cite its id in the relevant `nets[]` entry.
4. Run `npm run test:run` (integrity) and `npm run typecheck`.

## Provenance

Per-file source URLs and SHA256 hashes are recorded in
`keyArtifactstosort/reference/EVIDENCE-MANIFEST.md` — the hash register that lives with the
artifacts themselves. Use it to check provenance.

## CAD archives (Garage + N5)

Catalog CAD rows and the non-catalog extras live in Garage `hangar-library` (and the N5 mirror).
Do **not** merge CAD binaries onto `main`. The former `data/hardware-cad-assets` LFS side-stash
was retired after Garage + N5 SHA256 proof on 2026-08-10.

| Object key | Contents | Trap |
| --- | --- | --- |
| `05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip` | Beast PT STEP geometry (catalog) | Local LFS filename was `…_step.zip` (lowercase) |
| `06-Jetson-Orin/UGV_Beast_PT_Jetson_Orin_3D.zip` | Beast Orin CAD (catalog) | Source filename uses a hyphen: `…Orin-3D.zip` |
| `extra/UGV_Beast_PT_AI_Kit_3D.zip` | **2D drawings** (despite the name) | — |
| `extra/UGV_Beast_PI4B_AI_Kit_step.zip` | Pi kit STEP | — |
| `extra/UGV_Beast_PI4B_AI_Kit_3D.zip` | **2D drawings** (despite the name) | Title block reads "UGV Beast PT" |
| `extra/UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 2D drawings | **Rover, not Beast** |
| `extra/UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | STEP geometry | **Rover, not Beast** |

**Three naming traps, verified 2026-07-27 (still true):** `_3D.zip` archives contain 2D drawings
(3D geometry is in `_step` / `_STEP`); both "Rover … Orin" archives are Rover kits; the PI4B
`_3D.zip` title block says "PT". One archive uses non-ASCII internal paths (`尺寸图纸`) —
extract with explicit UTF-8 handling.

SHA-256 values for the uploaded set are in `db/hangar/library-manifest.json`. Historical intake
notes remain in `keyArtifactstosort/INTAKE-REGISTER.md` and the evidence register (Datacore
`beast-evidence-manifest` / `keyArtifactstosort/reference/EVIDENCE-MANIFEST.md` when present).

What the CAD is *for* (mounting holes, mast planning, URDF, twin geometry) is tracked as work in
[`docs/plans/2026-07-30-wiring-model-completion.md`](./plans/2026-07-30-wiring-model-completion.md).
$b_cad_assets$,'docs/hardware-library.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-vision','Beast Vision and Capture — Research Index','research','Research index (non-definitive): Build A offline splat vs Build B live nav, current open questions, and reading order for the vision pack.',ARRAY['vision','beast','research','splat','camera','lidar']::text[],ARRAY['rnd-beast-vision','build a','build b','gaussian splat','3dgs','appearance capture','stop-and-shoot','servo head','pan-tilt camera']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-vision',$b_beast_vision$# 00 MASTER: Beast Vision and Capture

Last updated: 2026-07-28
Supersedes the earlier vision doc set (00 master / 01 video pipeline / 02 camera candidates / 03 unscoped thermal+zoom). The video pipeline doc still stands on its own; the camera-candidates doc is superseded by `02-camera-decision.md` here.

## Doc set

| Doc | Covers |
|---|---|
| `01-splatting-architecture.md` | **The key ruling.** Which reconstruction architecture Build A uses, and what it does and does not require of the camera |
| `02-camera-decision.md` | The servo-head camera ruling, candidate, open flags |
| `03-rejected-paths.md` | Every path explored and killed, with the reason. Read before re-proposing anything |
| `04-lidar-open-decision.md` | Livox Mid-360S vs RoboSense Airy 96, still open |
| `05-research-method.md` | How the research went wrong, and where the real communities are |

## Current state in one table

| Question | Status | Where |
|---|---|---|
| Reconstruction architecture | **Ruled: images carry poses, LiDAR supplies geometry** | 01 |
| Servo-head camera | **Ruled: Arducam B0497 IMX678, $159.99**, pending flags | 02 |
| Fixed camera slot | Already filled by owned OAK-D Lite | 02 |
| Capture method | Stop-and-shoot, rover parked | 01 |
| Time synchronization | **Not required.** Falls out of parked capture | 01 |
| Camera-to-LiDAR extrinsic | Not load-bearing under the ruled architecture | 01 |
| LiDAR model | Open | 04 |
| Thermal, zoom, PTZ, FPV | All killed | 03 |

## Two missions, kept separate

```mermaid
flowchart TD
    L[3D LiDAR] --> A[Build B: live navigation SLAM]
    L --> C[Point cloud for geometry]
    S[Servo camera] --> I[Still images, parked]
    I --> P[Pose recovery from images]
    P --> G[Gaussian splat training on RTX 5090]
    C --> G
    O[OAK-D Lite, fixed] --> A
```

Build A is offline. Nothing about it needs to run in real time, and that fact removes most of the hardware requirements that dominated earlier drafts.

## Reading order for a new agent

1. `01-splatting-architecture.md` first. Everything else follows from it.
2. `03-rejected-paths.md` second, to avoid re-opening closed questions.
3. `05-research-method.md` before doing any new research on this topic.
$b_beast_vision$,'artifactIntake/00-MASTER-beast-vision.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-splat-architecture','Splatting Architecture — Images Carry Poses','research','Research ruling (non-definitive): Architecture B for Build A — COLMAP/SfM poses from parked stop-and-shoot images; LiDAR as geometry enrichment, not pose master.',ARRAY['vision','beast','research','splat','architecture']::text[],ARRAY['gaussian','3dgs','colmap','sfm','dn-splatter','lidar-gsplat','splatfacto','nerfstudio','architecture a','architecture b','depth supervision','pose','parked capture']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-splat-architecture',$b_beast_splat_architecture$# 01: Splatting Architecture Ruling

Status: **RULED**, 2026-07-28, verified against primary sources.
This is the doc that governs the rest. Several earlier recommendations were wrong because this question was never asked.

## The two architectures

```mermaid
flowchart LR
    subgraph A[Architecture A: LiDAR carries poses]
      A1[LiDAR-inertial odometry] --> A2[Trajectory]
      A2 --> A3[Compose with fixed cam-to-LiDAR extrinsic]
      A3 --> A4[Camera poses]
    end
    subgraph B[Architecture B: images carry poses]
      B1[Images] --> B2[COLMAP / SfM]
      B2 --> B3[Camera poses]
      B4[LiDAR cloud] --> B5[Initialization + depth supervision]
    end
```

| | Architecture A | Architecture B |
|---|---|---|
| Pose source | LiDAR-inertial odometry | The images themselves |
| LiDAR role | Master timing and pose reference | Geometry: dense init and depth supervision |
| Examples | Gaussian-LIC, Gaussian-LIC2, FAST-LIVO2 | DN-Splatter, splatfacto, lidar-gsplat |
| Needs rigid cam-to-LiDAR mount | **Yes, critically** | No |
| Needs sub-ms time sync | **Yes** | No |
| Needs hardware trigger | Often | No |
| Real-time capable | Yes, that is its point | No, offline |

## The ruling: Architecture B

Build A is offline. Real-time capability buys nothing. Architecture A's entire cost structure exists to serve a requirement Build A does not have.

## Why this is the right read (sourcing)

Three independent primary sources, checked 2026-07-28:

- **The DN-Splatter paper** (Turkulainen et al., WACV 2025) describes COLMAP SfM initialization alongside sensor depth initialization, and in its own implementation details states it uses the iPhone sequences **with COLMAP registered poses**. The reference implementation of depth-supervised splatting takes poses from images and uses the depth sensor only for supervision.
- **theLodgeBots/lidar-gsplat** is this architecture in three scripts: `prepare_colmap_with_depth.py` (COLMAP format plus depth maps), `lidar_to_pointcloud.py` (dense init from LiDAR back-projection), `train_with_depth.py` (depth-supervised trainer).
- **Course material for this exact task** states the original 3DGS work used RGB-only with COLMAP poses, and that dropping the LiDAR costs you depth supervision and falls back to COLMAP's sparse cloud instead of dense LiDAR points. The LiDAR is enrichment, not the pose source.

Supporting: depth supervision from LiDAR or SfM point clouds is a well-established line going back to DS-NeRF (2021), where models converge faster, reach higher final quality, and need fewer training views.

## The finding that settles it

A paper evaluating alternatives to SfM point cloud initialization tested COLMAP-free training using ORB-SLAM3 poses. It ran significantly faster than the COLMAP pipeline but produced **lower PSNR, which the authors attribute to less accurate pose estimation**.

SLAM-derived poses appear to be *worse* for splat quality than poses recovered from the images. Architecture A is the real-time path, not the premium path. Treating it as premium was the root error in earlier drafts.

## What this rules out as a requirement

Each of these was treated as load-bearing in earlier drafts. Under Architecture B, none are:

| Requirement | Why it dissolves |
|---|---|
| Rigid co-mounting of camera and LiDAR on one plate | COLMAP does not care how the camera got where it was |
| Sub-millisecond LiDAR-camera time sync | Only matters if LiDAR timing defines camera pose |
| Hardware trigger wire from LiDAR to camera | Same |
| MCU emulating a GNSS receiver to fake a shared clock | Same |
| Global shutter | Needed when a moving platform's rolling readout corrupts geometry. Parked capture removes the motion |
| Machine-vision camera class with trigger input | Follows from the above |
| Precise camera-to-LiDAR extrinsic calibration | Register the cloud to the finished reconstruction afterward instead |

**The servo mount is therefore fine, and probably an advantage:** more viewpoints per stop without moving the rover.

## Capture method: stop-and-shoot

Park the rover. Drive the servo to a position. Shoot. Repeat.

This is the single decision that removes the most complexity:

- No motion means no motion blur
- No motion means rolling shutter is harmless
- No motion means timing between sensors is irrelevant
- Parked, you can use long exposures, so low-light sensitivity stops being critical

Sanity check from the literature: 3DGS normally wants steady, high-quality photographs, and there is a whole published method (Seiskari et al., Spectacular AI) for compensating the motion blur and rolling shutter that handheld capture introduces. Parking sidesteps the problem the paper exists to solve.

## Resolution ceiling

Nerfstudio's splatfacto downscales by default so the maximum image dimension is under 1600px. Published benchmarks downsample further for VRAM reasons; the FIORD dataset team downsampled 4x to 800x800 because full resolution exceeded RAM on a 24GB RTX 4090.

Practical target is roughly **4K / 8MP**, not more. Beyond that the trainer discards the pixels and you buy VRAM problems.

Confidence: medium. The 1600px figure is a **default**, not a hard ceiling, and can be overridden. The 5090 has more headroom than the 4090 in the benchmark. Treat 4K as "sufficient, do not chase more," not as a proven optimum.

## Radiometric discipline (the part that does still matter)

Splatting assumes a surface looks the same colour from every viewpoint. Two things break that:

**Auto exposure and auto white balance.** Frame-to-frame brightness and colour shifts cause the optimizer to invent semi-transparent Gaussians in front of surfaces, producing cloudy artifacts. Lock exposure and white balance manually. The chosen camera exposes both as manual UVC controls.

**Onboard lighting.** A light mounted to the rover moves with the camera, so the same wall is lit from a different angle in every shot. That bakes view-dependent shading into what should be view-independent appearance. Fixed lights placed in the space, or sufficient ambient light, work. A lamp on the robot does not.

Note the earlier advice to shoot at f/8 to f/11 came from a weak source and does not apply: the chosen module has a fixed aperture and cannot be stopped down.
$b_beast_splat_architecture$,'artifactIntake/01-splatting-architecture.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-servo-camera','Servo-Head Camera — Research Candidate','research','Research candidate (not purchased): Arducam B0497 IMX678 for the pan-tilt head, pending focus / IR-cut / fps flags. Fixed slot stays owned OAK-D Lite.',ARRAY['vision','beast','research','camera']::text[],ARRAY['arducam','b0497','imx678','starvis','imx585','uvc','m12','servo camera','pan tilt','oak-d','rolling shutter']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-servo-camera',$b_beast_servo_camera$# 02: Servo-Head Camera Decision

Status: **RULED**, pending three verification flags.
Supersedes the earlier camera-candidates doc entirely; that doc's analysis was built on premises that did not survive (see `03-rejected-paths.md`).

## Slot definition

This decision covers **the camera on the 2-DOF servo pan-tilt head only.**

| Slot | Occupant | Notes |
|---|---|---|
| Fixed chassis mount | **OAK-D Lite, already owned** | Build B perception. Carries a CAUTION verdict: passive stereo fails in dark or textureless scenes, and there is documented USB brownout on the Beast rail |
| **Servo pan-tilt head** | **This decision** | Currently the stock 5MP 160° USB camera |
| LiDAR mount | Open, see `04` | Servo-vs-rigid mounting for the LiDAR is a separate unresolved question |

## The ruling

**Arducam B0497: 8.3MP Sony STARVIS 2 IMX678 USB 3.0 camera module, $159.99.**

Verified on Arducam's product page, 2026-07-28.

| Property | Value |
|---|---|
| Sensor | Sony STARVIS 2 IMX678, 1/1.8", back-illuminated |
| Pixel size | 2 x 2 µm |
| Resolution / rate | 3840x2160 at 15fps; 1920x1080 at 60fps; 1280x720 at 90fps |
| Shutter | Rolling (acceptable, see `01`) |
| Lens | F1.65, 100° diagonal, **M12 mount**, fixed focus |
| Interface | USB 3.2 Gen 1 Type-C, **UVC, no drivers** |
| Board size | 34 x 34 mm |
| Power | 1.48W max, 0.86W min |
| Manual controls | Brightness, contrast, saturation, **white balance auto/manual**, gain, backlight comp, **exposure auto/manual** |

## Why this one

| Criterion | Fit |
|---|---|
| 4K resolution target from `01` | 8.3MP, exactly at the useful ceiling |
| Low light | STARVIS 2 back-illuminated; the strongest consumer-tier low-light sensor family |
| Fits the servo head | 34x34mm board |
| Will not brown out the rail | 1.48W max, the documented failure mode on this chassis |
| Locked exposure and white balance | Manual UVC controls present, which `01` requires |
| No driver work on the Jetson | UVC compliant |
| Lens flexibility | M12 mount, lenses swappable |

The Jetson Orin Nano Super carrier has 4x USB 3.2 Gen 2 Type-A ports, so the host is not a constraint. Verify actual negotiation with `lsusb -t`; there are field reports of these kits enumerating at USB 2.0 speeds due to cable or hub quality.

## Three flags before purchase

1. **Fixed focus is set for 3m to infinity.** Any indoor or crawlspace work is inside that range and will be soft. The M12 mount means a closer-focusing lens can be fitted; budget for one. Do not assume the stock lens works indoors.
2. **Integral IR-cut filter, visible light only.** No IR-illuminator option with this variant.
3. **4K runs at only 15fps.** Irrelevant for stop-and-shoot. Disqualifying for live teleop, which would run from the 1080p60 or 720p90 modes or from a separate camera.

## Alternatives considered, not chosen

| Option | Why not |
|---|---|
| Arducam IMX585 USB 3.0 + 16mm C-mount | Larger 1/1.2" sensor and better low light, but the listed bundle ships a 50° telephoto, wrong optic for scene capture |
| INNO-MAKER CAM-IMX585 MIPI CSI | 10/12/16-bit RAW output avoids the onboard ISP black box, which is genuinely attractive for reconstruction. Killed by CSI ribbon routing on a rotating mount: cables are short and rigid |
| Arducam IMX678 USB 2.0 variant | Same sensor, bandwidth-limited |
| Machine-vision cameras (LUCID Triton, FLIR Blackfly S) | Recommended by an external research pass. Correct for Architecture A, unnecessary under the ruled architecture. Also 12-24V or PoE power, C-mount lenses heavier than the camera body, several times the cost |

## Open item: servo repeatability

Not a blocker under Architecture B, but worth measuring: command a servo preset repeatedly and observe how tightly it lands. Approach each preset from the same direction to reduce hysteresis, and let it settle before shooting. Relevant if per-position calibration is ever wanted later.

**Note:** an earlier suggestion to calibrate one rigid transform per servo preset was invented on the spot and is not documented practice. It is not part of this ruling.
$b_beast_servo_camera$,'artifactIntake/02-camera-decision.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-rejected-paths','Vision Paths Rejected — Do Not Re-Propose Blindly','research','Research kill list: FPV chains, Insta360, IP PTZ, thermal, optical zoom, and machine-vision cameras killed under the current premise — read before reopening.',ARRAY['vision','beast','research','rejected','camera']::text[],ARRAY['killed','kill list','fpv','dji','walksnail','o3','insta360','ptz','thermal','lepton','infiray','zoom','blackfly','lucid','triton']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-rejected-paths',$b_beast_rejected_paths$# 03: Rejected Paths

Read this before proposing any camera or sensor for the Beast. Every entry below was explored and killed. The premise for the servo camera changed **four times** during exploration, so the reasoning matters more than the verdicts.

## Premise history

```mermaid
flowchart TD
    P1[Premise 1: crawlspace low-light teleop] --> P2[Premise 2: speed and motion fidelity]
    P2 --> P3[Premise 3: outdoor zoom for wildlife and perimeter]
    P3 --> P4[Premise 4: appearance capture for Gaussian splatting]
    P4 --> R[Ruled: see 02-camera-decision.md]
```

Each shift invalidated the prior recommendation. If a new premise appears, expect the same.

## Killed: hardware

| Path | Killed because |
|---|---|
| **DJI O3 / Walksnail FPV chain** | Air units output only to proprietary goggles or receivers; cannot feed a Quest 3 directly. Routing via HDMI to PC to Virtual Desktop reintroduces the latency it was meant to remove. $150 to $300+ for the air unit alone |
| **Insta360 X5** | Recommended by another agent for 360° appearance capture. Not a UVC device; webcam mode caps at 2880x1440/30fps; standalone body with own battery and microSD; makes the pan-tilt pointless; runs hot in 360 mode, which is bad in a sealed crawlspace; $549.99. Its actual pitch (Splatica-style, 360 capture replacing LiDAR) competes with the LiDAR-fused pipeline rather than complementing it |
| **IP PTZ security cameras** (SV3C, Avalonix, UniFi G6) | Correct capability set for wildlife and perimeter, wrong physical scale entirely. A security PTZ is roughly grapefruit-sized; the Beast head is sized for a 38x38mm board. Also 12V or PoE power on an 11.1V nominal rail with brownout history |
| **FLIR Lepton thermal** | Lepton XDS ($239, thermal plus co-registered 5MP visible, the best value by a clear margin) sold out at GroupGets and unavailable elsewhere. Remaining path is Lepton 3.5 ($164 GroupGets / $172 Digi-Key) plus a PureThermal carrier ($110 to $125), roughly $279 for thermal alone. The cheap non-radiometric 500-0771-FS1 is volume-only: zero stock, 100-piece minimum. Also 8.7fps, an export-classification design choice |
| **InfiRay Tiny1-C / P2 Pro** | Genuinely better than Lepton on the specs that matter: 256x192 vs 160x120, 25Hz vs 8.7Hz, 0.22°/px vs 0.36°/px angular resolution, USB-C native, 9g, ~$268 to $279. Not pursued once thermal itself was dropped. **Revisit this first if thermal ever returns** |
| **Motorized optical zoom modules** | Cheap "10x zoom" USB modules are manual varifocal: you twist the barrel by hand, useless on a deployed rover. Motorized UVC-controllable options exist (e-con See3CAM_30Z10X, IMX179 blocks) but zoom was dropped on principle, below |
| **Manual varifocal 5-50mm** | Same: set-once-in-the-garage focal length |
| **Machine-vision cameras** (LUCID Triton TRI050S-C, FLIR Blackfly S) | Correct under Architecture A. Unnecessary under the ruled Architecture B. See `01` |

## Killed: concepts

**Zoom as an organizing goal.** Three stacking reasons:
1. Small package plus long focal length means a tiny entrance pupil, so the image is darkest exactly when zoomed. Both target missions were low-light missions.
2. 10x magnifies angular jitter 10x. Hobby bus servos have backlash; the chassis settles after stopping.
3. **The rover already is the zoom.** Mobility and focal length buy the same thing. Paying for zoom to avoid driving closer pays twice for one capability, in the currency this platform is poorest in.

**Thermal as the wildlife and perimeter answer.** Sound reasoning, killed on availability. Range was not the problem: the Lepton 3.5 at 0.36°/px puts roughly 5 pixels on a deer at 50m, which is comfortable detection, marginal to 100m. The real caveat is that thermal contrast collapses when ambient approaches body temperature, so Tennessee summers are the worst case.

**Perimeter monitoring as a rover mission.** A fixed pole camera beats a rover on perimeter: always on, mains powered, permanently positioned. The rover's genuine advantage is investigating what a fixed sensor detected, and reaching places with no coverage.

## Known chassis constraints

- The Beast is **explicitly not waterproof**. This limits outdoor missions more than any camera choice does, and makes an IP-rated camera housing pointless over an open chassis.
- Documented **USB brownout** on the Beast power rail, from the OAK-D Lite evaluation. Check power budget before adding USB devices.
- Max speed 0.35 m/s.
- Pan-tilt supports IMU-based vertical stabilization, tuned for driving rather than precision pointing.
$b_beast_rejected_paths$,'artifactIntake/03-rejected-paths.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-lidar-open','LiDAR Upgrade — Still Open','research','Open research (not a ruling): Livox Mid-360S vs RoboSense Airy 96, plus unresolved servo-vs-rigid mounting for navigation SLAM.',ARRAY['vision','beast','research','lidar']::text[],ARRAY['livox','mid-360','mid360','mid-360s','robosense','airy','airy 96','fast-lio','fast-livo','slam','point rate']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-lidar-open',$b_beast_lidar_open$# 04: LiDAR Open Decision

Status: **OPEN.** Livox Mid-360S vs RoboSense Airy 96.

## The comparison as supplied

| Metric | RoboSense Airy 96 | Livox Mid-360S |
|---|---|---|
| Listed price | $999 manufacturer-direct | $789 SensorLidar |
| Vertical FoV | 90° | 59°, -7° to +52° |
| Point rate, single return | 856,320 pts/s | 200,000 pts/s |
| Scan pattern | Repetitive, structured, 0.4° x 0.947° grid | Non-repetitive rotating mirror |
| Range at 10% reflectivity | 30 m | 40 m |
| Typical power | <8 W | 6.5 W |
| Weight | <240 g | 265 g |
| IMU | Yes | ICM40609 |
| Protection | IP67 / IP6K9K claimed | IP67 |
| Stock | "Consult customer service" / "notify me" | In stock, five remaining |

## Considerations the table does not capture

| Consideration | Detail | Leans |
|---|---|---|
| **Software lineage** | The Build A tooling lineage (FAST-LIO2, FAST-LIVO2, Gaussian-LIC) is HKU MARS lab and Livox-native. Upstream FAST-LIO requires livox_ros_driver installed and sourced before any launch file runs, even for non-Livox sensors. RoboSense ships official ROS/ROS2 drivers via rslidar_sdk and community forks add Airy support to FAST-LIO, but that is a fork rather than the reference path | **Mid**, strongly |
| **Vertical FoV shape** | Airy's 90° is a hemispherical dome **above** the mounting plane: 360° horizontal, 90° vertical upward. Verify how much it sees below horizontal before assuming 90° means more useful coverage on a low rover | **Verify first** |
| **Compute** | 856k pts/s is 4.28x the Livox rate into an Orin Nano already budgeted 1 to 2 of 6 cores at Livox rates. Likely needs decimation, which partly negates the density advantage | **Mid** |
| **Scan pattern vs mission** | Non-repetitive accumulates coverage with dwell time, suiting Build A's capture-then-train pattern. Repetitive structured grid gives frame-to-frame predictability, suiting Build B nav | **Split** |
| **Outdoor range** | Mid reaches 40m at 10% reflectivity vs Airy's 30m. RoboSense positions the Airy primarily for indoor and semi-outdoor use | **Mid** |
| **Availability and price** | Airy shows "consult customer service" against an in-stock Mid at $210 less | **Mid** |

Nitpicks on the source table: the precision figures are not comparable (1.5cm accuracy vs ≤2cm at 10m are different measurements).

## Current read

The Airy is the better sensor on paper and likely the worse choice for this specific pipeline. The 4.28x point rate is the headline number and helps least: the Orin cannot fully consume it, and splatting geometry comes from dwell time rather than instantaneous density.

Confidence: medium. Not a ruling.

## Separate unresolved question: mounting

Whether the LiDAR goes on the servo head or rigid to the chassis is **not settled.**

Argument against servo-mounting the LiDAR: FAST-LIO2 assumes a fixed LiDAR-to-IMU extrinsic. The Mid-360's IMU is internal, so a gimbal-mounted assembly would track the gimbal rather than the chassis, and servo backlash becomes odometry noise directly.

This concern applies to Build B navigation SLAM. Under the Architecture B ruling in `01`, it does not affect Build A capture quality.
$b_beast_lidar_open$,'artifactIntake/04-lidar-open-decision.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-research-method','Vision Research Method Post-Mortem','research','How the vision exploration went wrong (spec-sheet queries, self-citation) and which communities actually answer failure modes.',ARRAY['vision','beast','research','method']::text[],ARRAY['post-mortem','spec sheet','self-citation','nvidia forums','ros discourse','radiancefields','koide','calibration toolbox','hku-mars']::text[],'beast-vision','2026-07-28','/datacore/briefing/beast-research-method',$b_beast_research_method$# 05: Research Method Post-Mortem

Read before doing further research on this project. The method used for most of this exploration was wrong in a specific, repeatable way.

## What went wrong

Roughly sixteen searches were run, nearly all shaped `[product] [spec] [price] [year]`:

- `Arducam IMX291 IMX462 low light USB camera robot price Amazon 2026`
- `ELP AR0234 global shutter USB camera 90fps 1080p price Amazon 2026`
- `small thermal camera module USB Jetson robot FLIR Lepton Boson InfiRay price`
- `IMX585 IMX678 STARVIS 2 Jetson Orin camera module 4K low light MIPI CSI price`

That shape returns manufacturer pages, distributor listings, and SEO aggregators. It tells you what a thing claims to be. It never tells you what broke when someone tried it.

**The tell:** the single most decision-changing finding of the whole exploration, the nerfstudio 1600px downscale default, came from a GitHub issue where someone was frustrated a flag would not work. It surfaced by accident. Everything found by design was a spec sheet.

Consequences: calibration, time synchronization, the moving-mount problem, and ultimately the entire Architecture A vs B question never surfaced until challenged directly.

## A second failure mode: self-citation

At one point the depth-supervised splatting workflow was recalled from prior conversation history and presented as knowledge. That was circular: it was a previous assistant output being cited back as evidence. It happened to hold up when verified against primary sources, but the verification was the thing that mattered, not the recall.

**Rule: prior conversation content is a lead, not a source. Verify it.**

## Query shapes that work

| Goal | Shape |
|---|---|
| Practitioner experience | Add failure wording: "doesn't work", "problem", "anyone tried", "lessons learned", "gotcha" |
| Platform-specific reality | Site-scoped: `site:forums.developer.nvidia.com IMX678 Orin Nano` |
| What actually breaks | Search issues, not products: `FAST-LIO camera sync github issue` |
| How people build | `built a lidar camera rig` rather than `lidar camera rig price` |
| Ground truth on a method | Go to the paper's own implementation details section, not a summary |

Price verification against live retail pages is still correct **for the buying step**. The error was running it as the entire method.

## Where the communities are

| Community | Answers |
|---|---|
| **NVIDIA Developer Forums**, Jetson subforums | Camera drivers, CSI, sync, calibration on Orin. The DRIVE subforums carry years of threads on camera-LiDAR PTP alignment, GMSL frame sync, and triggering other sensors from cameras |
| **ROS Discourse** (discourse.openrobotics.org) | Multi-sensor sync and calibration as a systems problem |
| **radiancefields.com** and its Radiant newsletter | Splatting industry and research, monthly wrap-ups of platform updates, code releases, research |
| **awesome-3d-splatting-survey** (GitHub, w-m) | Unusual format: every publication and implementation gets its own GitHub issue for discussion, feeding a living survey |
| **hku-mars GitHub issues** | FAST-LIO, FAST-LIVO2, livox_camera_calib. Where people report what fails on real rigs |
| **nerfstudio GitHub issues and Discord** | splatfacto behavior, VRAM, resolution |
| **Arducam forum** (forum.arducam.com) | Module-specific quirks |
| **Livox-SDK GitHub** | Drivers and the chessboard calibration tool verified on Mid-40, Horizon, Tele-15 |

## Calibration tooling, if ever needed

Not load-bearing under the Architecture B ruling, but recorded so it does not need re-finding:

- **Koide's direct_visual_lidar_calibration.** Targetless, single-shot, no manual initialization, and does not require overlapping FOV in a single frame provided the robot rotates to observe common areas. Uses scan accumulation via KISS-ICP, SuperGlue keypoint matching for an initial guess, then Ceres optimization minimizing Normalized Information Distance between LiDAR reflectivity and camera intensity. Better fit than the alternatives for a small rig.
- **hku-mars/livox_camera_calib.** Targetless, edge-information based, reports pixel-level accuracy. Demonstrated on denser Avia and Horizon clouds; whether it works with the Mid-360's sparser 200k pts/s non-repetitive pattern is unverified.
- **Livox-SDK/livox_camera_lidar_calibration.** Chessboard-based, verified on Mid-40, Horizon, Tele-15.

## On external research passes

Two agent-produced research documents were reviewed during this exploration. Both were useful as problem inventories and wrong in the same way: **both assumed the rover is moving while capturing, and one assumed the camera does the tracking.** Neither assumption holds here.

Specific value extracted:
- The **planar motion observability trap**: Kalibr-style continuous-time calibration needs aggressive 6-DoF excitation to decouple accelerometer bias from gravity, which a tracked rover cannot produce. Worth knowing if IMU-based calibration is ever attempted.
- The **triggered exposure floor**: minimum exposure on some industrial cameras jumps by an order of magnitude once hardware triggering is enabled. Classic spec-sheet-invisible integration surprise.
- Koide's toolbox, above.

Specific misses:
- One assumed an Ouster LiDAR throughout, building its whole timing plan on a spinning-LiDAR encoder-angle trigger output. Neither candidate LiDAR advertises a camera trigger output, and the document never noticed.
- One conceded in its own text that when the robot is stationary, temporal misalignment has no effect, which undercuts its own headline recommendation for parked capture.
- Both scaled mounting and camera recommendations for a much larger vehicle.
- All citation markers in both were unresolvable, so the specific figures cannot be checked.

**If commissioning another pass:** state the platform scale, the offline-capture assumption, and the parked-capture assumption up front, or it will return the moving-vehicle answer again.
$b_beast_research_method$,'artifactIntake/05-research-method.md');
INSERT INTO briefings(id,title,kind,summary,tags,aliases,pack_id,captured_at,href,body_markdown,repo_path) VALUES ('beast-evidence-manifest','BEAST-01 Source Evidence Manifest','research','Historical SHA256 manifest of BEAST-01 source evidence cached under UGV-Beast-Archive/ on 2026-07-01; verify local cache and upstream before migrating payloads.',ARRAY['artifacts','beast','provenance','evidence']::text[],ARRAY[]::text[],'beast-vision','2026-07-27','/datacore/briefing/beast-evidence-manifest',$b_beast_evidence_manifest$---
title: BEAST-01 Source Evidence Manifest
audience: AI agents and operators migrating BEAST source evidence to object storage
status: historical reference
last_updated: 2026-07-01
---

# BEAST-01 Source Evidence Manifest

This historical manifest records BEAST-01 source evidence that was cached under the ignored
`UGV-Beast-Archive/` directory on 2026-07-01. The files must stay out of git. Before migrating or
relying on these payloads, verify the current local cache, upstream sources, and owner docs.

The hashes below were computed locally on 2026-07-01 with SHA256. Local paths use
the ignored cache path that existed at the time of this snapshot.

## Manifest

| ID | Type | Subsystem | Source URL | Local ignored path | Bytes | SHA256 | Future S3 key |
|---|---|---|---|---|---:|---|---|
| general-driver-dimensions-dxf | CAD | Driver board | https://files.waveshare.com/upload/5/50/GENERAL-DRIVER-FOR-ROBOTS-STR-DXF.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Dimensions_DXF.zip` | 115624 | `83a4ccd0957f2200c2e7dfe4946b56b50688286598841b850d6840e606c530cc` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Dimensions_DXF.zip` |
| general-driver-dimensions-pdf | PDF/CAD | Driver board | https://files.waveshare.com/upload/0/0a/GENERAL-DRIVER-FOR-ROBOTS-STR-PDF.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Dimensions_PDF.zip` | 132095 | `757155cbb7ebfeb6358a25b2fc14fa41da0b62baf35ee3270b001214d9ee2173` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Dimensions_PDF.zip` |
| general-driver-schematic | PDF | Driver board | https://files.waveshare.com/upload/3/37/General_Driver_for_Robots.pdf | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Schematic.pdf` | 1008991 | `dab698578c1b75bdf72a5ade4bada2d9f5a5da54f37737e1f41b0b2c59b9ce8a` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Schematic.pdf` |
| general-driver-step | CAD | Driver board | https://files.waveshare.com/upload/8/8e/General_Driver_for_Robots_STEP.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_STEP.zip` | 1098032 | `51e402703c5429a1068817a290a3078b994aecf87125f741ce0331ff1549eec8` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_STEP.zip` |
| ros-driver-schematic | PDF | Driver board | https://files.waveshare.com/wiki/RaspRover/ROS_Driver_for_Robots.pdf | `UGV-Beast-Archive\02-Driver-Board\ROS_Driver_for_Robots_Schematic.pdf` | 1023807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | `beast/source-archive/02-driver-board/ROS_Driver_for_Robots_Schematic.pdf` |
| ups-code | Code archive | Power / UPS | https://files.waveshare.com/upload/e/ea/UPS_Module_3S_Code.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_Code.zip` | 23084509 | `734edc42fc017c8128235a5240d9239344f465ef0f52810db93d1b658e7a9d4e` | `beast/source-archive/03-power-ups/UPS_Module_3S_Code.zip` |
| ups-dimensions-dxf | CAD | Power / UPS | https://files.waveshare.com/upload/f/f6/UPS_Module_3Sdxf.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_Dimensions_DXF.zip` | 17867 | `3907ab3f23c82f2cdfe02f098d9ca22ad7bdb79ac8a88b561713323b6e33bb4e` | `beast/source-archive/03-power-ups/UPS_Module_3S_Dimensions_DXF.zip` |
| ups-step | CAD | Power / UPS | https://files.waveshare.com/upload/3/38/UPS_Module_3Sstep.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_STEP.zip` | 22277 | `a278f656fd425c6a421c753946386efc7a6b7008bfb66aa0acaef76a77ea3fde` | `beast/source-archive/03-power-ups/UPS_Module_3S_STEP.zip` |
| ups-schematic | PDF | Power / UPS | https://www.waveshare.com/w/upload/5/53/Ups01.pdf | `UGV-Beast-Archive\03-Power-UPS\Ups01_Schematic.pdf` | 1352928 | `ea654047e0c8ae1b8128ecf878ae69e976646ea504c1e6619432751eb452a3b2` | `beast/source-archive/03-power-ups/Ups01_Schematic.pdf` |
| st-bus-servo-control-circuit | PDF | Servos | https://files.waveshare.com/upload/d/d3/Bus_servo_control_circuit.pdf | `UGV-Beast-Archive\04-Servos\ST_Bus_Servo_Control_Circuit.pdf` | 141892 | `2d732e7bbaa7fb0ca70da324030b41f50ec39033dba2cfa35234e2be323bcbf4` | `beast/source-archive/04-servos/ST_Bus_Servo_Control_Circuit.pdf` |
| st-servo-protocol-manual | PDF | Servos | https://files.waveshare.com/upload/2/27/Communication_Protocol_User_Manual-EN%28191218-0923%29.pdf | `UGV-Beast-Archive\04-Servos\ST_Servo_Communication_Protocol_Manual.pdf` | 332610 | `3bf67ac6e28ac37e98a083ce1c32201801123b065d01632350c54fd1d184af5a` | `beast/source-archive/04-servos/ST_Servo_Communication_Protocol_Manual.pdf` |
| st-servo-firmware | Firmware archive | Servos | https://files.waveshare.com/upload/d/d8/ST_Servo.zip | `UGV-Beast-Archive\04-Servos\ST_Servo_Firmware.zip` | 34767 | `939b9d88793b9cb8ef5d09222dfd6eb35c169f4cdc29d498eb0a1a6146752763` | `beast/source-archive/04-servos/ST_Servo_Firmware.zip` |
| st3215-servo-2d | CAD | Servos | https://files.waveshare.com/upload/0/08/ST3215-2D.zip | `UGV-Beast-Archive\04-Servos\ST3215_Servo_2D.zip` | 172516 | `bd034f5301ec271a77a87e8bf5f6bb9995bb3348ba728b97ae3c58dffa79dc1b` | `beast/source-archive/04-servos/ST3215_Servo_2D.zip` |
| st3215-servo-3d | CAD | Servos | https://files.waveshare.com/upload/5/59/ST3215-3D.zip | `UGV-Beast-Archive\04-Servos\ST3215_Servo_3D.zip` | 566939 | `2735561e0c1dc899b35d4740273e5340f15967028d2dd4014feed03d8175562c` | `beast/source-archive/04-servos/ST3215_Servo_3D.zip` |
| st3215-servo-user-manual | PDF | Servos | https://files.waveshare.com/upload/f/f4/ST3215_Servo_User_Manual.pdf | `UGV-Beast-Archive\04-Servos\ST3215_Servo_User_Manual.pdf` | 1606210 | `f37f43544e674e5eaf87c5a134f575fb37d207f2269f6e8c60328d9a82918d49` | `beast/source-archive/04-servos/ST3215_Servo_User_Manual.pdf` |
| beast-pi4b-3d | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PI4B_AI_Kit_3D.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PI4B_AI_Kit_3D.zip` | 272014 | `cb7d51373314daa966dff26a30cb04d05adcf7c8d57e03341516f6b0f6e74259` | `beast/source-archive/05-chassis-cad/UGV_Beast_PI4B_AI_Kit_3D.zip` |
| beast-pi4b-step | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PI4B_AI_Kit_step.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PI4B_AI_Kit_STEP.zip` | 11096497 | `b52f72922132568b8728d14c39c783edca1bb13bd1b5f0c694bde3e15c577f27` | `beast/source-archive/05-chassis-cad/UGV_Beast_PI4B_AI_Kit_STEP.zip` |
| beast-pt-3d | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PT_AI_Kit_3D.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PT_AI_Kit_3D.zip` | 307341 | `33db3df8d1ad24a92a1a74ce0d5360ec78950fa421e48bc5e780acc76e038c9a` | `beast/source-archive/05-chassis-cad/UGV_Beast_PT_AI_Kit_3D.zip` |
| beast-pt-step | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PT_AI_Kit_step.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PT_AI_Kit_STEP.zip` | 12303971 | `bf649936f7663c7e4520fe4e45aa02d0b5ae588e5c200229a1f2cbfdcd9b7631` | `beast/source-archive/05-chassis-cad/UGV_Beast_PT_AI_Kit_STEP.zip` |
| beast-jetson-orin-3d | CAD | Jetson Orin mount | https://files.waveshare.com/wiki/UGV-Beast-PT-Jetson-Orin-AI-Kit/UGV_Beast_PT_Jetson_Orin-3D.zip | `UGV-Beast-Archive\06-Jetson-Orin\UGV_Beast_PT_Jetson_Orin_3D.zip` | 15378700 | `56615c77a93b90b760e6e2277de55ff36fe8ff610f77d2fedb197ca0d6f879b4` | `beast/source-archive/06-jetson-orin/UGV_Beast_PT_Jetson_Orin_3D.zip` |
| beast-jetson-orin-2d | CAD | Jetson Orin mount | https://files.waveshare.com/wiki/UGV-Beast-PT-Jetson-Orin-AI-Kit/UGV_Beast_PT_Jetson_Orin_AI_Kit-2D.zip | `UGV-Beast-Archive\06-Jetson-Orin\UGV_Beast_PT_Jetson_Orin_AI_Kit_2D.zip` | 425915 | `acc6d8c8ae83d7ae5ddf9efe34960c3e0fcd0d126542fa9f7ef25682d7f4cd77` | `beast/source-archive/06-jetson-orin/UGV_Beast_PT_Jetson_Orin_AI_Kit_2D.zip` |
| cp210x-driver | Driver archive | Code / firmware | https://files.waveshare.com/wiki/common/CP210x_USB_TO_UART.zip | `UGV-Beast-Archive\07-Code-Firmware\CP210x_USB_TO_UART_Driver.zip` | 4953661 | `7cb2b9b40e5279e55409e84b3f018744b1aae9c06ac9779e549e7d19b5ad67b3` | `beast/source-archive/07-code-firmware/CP210x_USB_TO_UART_Driver.zip` |
| ros-driver-demo | Code archive | Code / firmware | https://files.waveshare.com/wiki/RaspRover/ROS_Driver.zip | `UGV-Beast-Archive\07-Code-Firmware\ROS_Driver_OpenSource_Demo.zip` | 6951776 | `bead7c9fa2948e6d2219bcdfe47f10fc182eba431148b1ff65f3fd4d4e18f87b` | `beast/source-archive/07-code-firmware/ROS_Driver_OpenSource_Demo.zip` |
| ugv-base-general-snapshot | Code snapshot | Code / firmware | https://github.com/waveshareteam/ugv_base_general/tree/d308df91b333a513f45a238bef9ba9a0a5edf64c | `UGV-Beast-Archive\07-Code-Firmware\ugv_base_general_repo_20260628.zip` | 7397722 | `5539128322b2f8f1b398de7c2bcb71ac73be0e27ccf3437442a1df5e2620b94e` | `beast/source-archive/07-code-firmware/ugv_base_general_repo_20260628.zip` |
| ugv-jetson-snapshot | Code snapshot | Code / firmware | https://github.com/waveshareteam/ugv_jetson/tree/18e9a24590e1bfdb39a1bc24aaf8a6af820805d3 | `UGV-Beast-Archive\07-Code-Firmware\ugv_jetson_code_20260628.zip` | 1335725 | `8e34b75ffed59eddb64f070f3bd6cad0d8a198125adb7edbc233d663947ecc6c` | `beast/source-archive/07-code-firmware/ugv_jetson_code_20260628.zip` |
| ugv01-base-esp32-firmware | Firmware archive | Code / firmware | https://files.waveshare.com/upload/0/0c/UGV01_BASE.zip | `UGV-Beast-Archive\07-Code-Firmware\UGV01_BASE_ESP32_Firmware.zip` | 28761 | `5daf339df0a8ca879230d806b8d5d62d65703b4e243b4827682077770bbef4e5` | `beast/source-archive/07-code-firmware/UGV01_BASE_ESP32_Firmware.zip` |
| general-driver-wiki | Wiki capture | Driver board | https://www.waveshare.com/wiki/General_Driver_for_Robots | `UGV-Beast-Archive\08-Wiki-Pages\General-Driver-for-Robots_Wiki.md` | 13181 | `68dd968008f2202a2c33042b313d5be2498ae1d76dd52c09e16eda229c3c37e1` | `beast/source-archive/08-wiki-pages/General-Driver-for-Robots_Wiki.md` |
| st3215-servo-wiki | Wiki capture | Servos | https://www.waveshare.com/wiki/ST3215_Servo | `UGV-Beast-Archive\08-Wiki-Pages\ST3215-Servo_Wiki.md` | 31935 | `b8e420425edbfe9e183e0e8a8cfa61a2a88e94125b56426d95983877bd5008e8` | `beast/source-archive/08-wiki-pages/ST3215-Servo_Wiki.md` |
| ugv-beast-product-page | Product page capture | UGV Beast | https://www.waveshare.com/ugv-beast.htm | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast_Product-Page.md` | 79972 | `e4989f5e30c059d6be71605fb821c737d912dec1052a3a7150465909ac466306` | `beast/source-archive/08-wiki-pages/UGV-Beast_Product-Page.md` |
| ugv-beast-wiki | Wiki capture | UGV Beast | https://www.waveshare.com/wiki/UGV-Beast | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast_Wiki.md` | 24485 | `eba192cd4055ed395e40eb1e3108c0609a3fcc9d66fd04f8f46d11bbafb5f5a8` | `beast/source-archive/08-wiki-pages/UGV-Beast_Wiki.md` |
| ugv-beast-jetson-orin-ros2-wiki | Wiki capture | Jetson Orin ROS2 | https://www.waveshare.com/wiki/UGV_Beast_Jetson_Orin_ROS2 | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast-Jetson-Orin-ROS2_Wiki.md` | 24468 | `6f7b0f432b0f92b2a36e059be1060de1b4d77c190621fc889cbf9c7e167579b8` | `beast/source-archive/08-wiki-pages/UGV-Beast-Jetson-Orin-ROS2_Wiki.md` |
| ugv-beast-jetson-orin-ai-kit-wiki | Wiki capture | Jetson Orin AI kit | https://www.waveshare.com/wiki/UGV_Beast_PT_Jetson_Orin_AI_Kit | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md` | 25262 | `1b3ed3cfc6d46b629c969cefd25acde117a7830a7a083a1e43c374e9f52c6d3f` | `beast/source-archive/08-wiki-pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md` |
| ups-module-3s-wiki | Wiki capture | Power / UPS | https://www.waveshare.com/wiki/UPS_Module_3S | `UGV-Beast-Archive\08-Wiki-Pages\UPS-Module-3S_Wiki.md` | 10060 | `6cbb18ce03addbb31835d26f2cb0be34039fa1db918955a92db5fb94c2fdab12` | `beast/source-archive/08-wiki-pages/UPS-Module-3S_Wiki.md` |

## Live upstream heads checked

These heads were checked on 2026-07-01 to compare the local code snapshots against
current upstream:

| Repo | Branch | Head |
|---|---|---|
| `waveshareteam/ugv_jetson` | `main` | `18e9a24590e1bfdb39a1bc24aaf8a6af820805d3` |
| `waveshareteam/ugv_base_general` | `main` | `d308df91b333a513f45a238bef9ba9a0a5edf64c` |
| `waveshareteam/ugv_ws` | `ros2-humble-develop` | `f0b3ad9c16e7acb6d6145f261116d71bf6338f4a` |
| `waveshareteam/ugv_rpi` | `main` | `3ae9f203f61bfaaf123ee376f78247d007880b0c` |

## Notes

- `UGV-Beast-Archive/` was the local cache for this snapshot; verify it still exists and matches
  before treating it as evidence for current work.
- The local cache also contains human-authored index/summary files. Those are useful
  operator notes, but the manifest above tracks payloads that should become object-store
  objects.
- Do not commit any file from `UGV-Beast-Archive/`.
$b_beast_evidence_manifest$,'keyArtifactstosort/reference/EVIDENCE-MANIFEST.md');

-- briefing_packs hub links
UPDATE briefing_packs SET hub_briefing_id = 'beast-vision' WHERE id = 'beast-vision';

-- <<< DATACORE_CORPUS_END

COMMIT;
