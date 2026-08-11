/* ==========================================================================
   2. SPECIES CATALOGUE  (219 animals)
   [name, plan, colour1, colour2, pattern, scale, biome, diet, groupMin,
    groupMax, price, appeal(1-10), lifespan(years), danger(1-5), opts?]

   The name carries both languages, split by `|` — see LN() in 01_i18n.js. A
   table this dense would be unreadable with a `{ pt, en }` object per row, and
   side by side a missing translation is visible on the line you are editing.
   ========================================================================== */
const SPECIES_RAW = [
/* ---------- FELINOS (14) ---------- */
["Leão|Lion","feline","#d9a441","#8a5a2b","solid",1.15,"savanna","carn",2,6,26000,9,18,4,{mane:1,tail:"tuft"}],
["Tigre-de-bengala|Bengal tiger","feline","#e08b32","#2b1c12","stripes",1.2,"jungle","carn",1,2,34000,10,20,5],
["Tigre-siberiano|Siberian tiger","feline","#e9a75c","#3a2718","stripes",1.3,"forest","carn",1,2,38000,10,20,5],
["Leopardo|Leopard","feline","#e0b64e","#332512","rosettes",.95,"savanna","carn",1,2,22000,8,17,4,{climber:1}],
["Onça-pintada|Jaguar","feline","#dca843","#2e2313","rosettes",1.05,"jungle","carn",1,2,26000,9,18,5],
["Guepardo|Cheetah","feline","#ddb968","#2c2113","spots",1,"savanna","carn",1,4,24000,9,14,3],
["Puma|Cougar","feline","#c69a68","#7a5a3a","solid",1,"mountain","carn",1,2,17000,7,16,4],
["Lince-europeu|Eurasian lynx","feline","#c8a276","#4a3524","spots",.8,"forest","carn",1,2,13000,6,15,3,{tail:"short",ear:"tuft"}],
["Jaguatirica|Ocelot","feline","#d2a45f","#3a2a17","rosettes",.7,"jungle","carn",1,2,11000,6,14,2],
["Caracal|Caracal","feline","#c99760","#5a4128","solid",.75,"desert","carn",1,2,12000,6,15,3,{ear:"tuft"}],
["Serval|Serval","feline","#dbb972","#332612","spots",.8,"savanna","carn",1,2,11500,6,15,2,{ear:"long"}],
["Leopardo-das-neves|Snow leopard","feline","#dfe3e6","#3d3a36","rosettes",.95,"mountain","carn",1,2,36000,10,17,4,{tail:"bushy"}],
["Gato-do-mato|Wildcat","feline","#b59a72","#4a3a26","stripes",.55,"forest","carn",1,3,6500,4,13,1],
["Pantera-negra|Black panther","feline","#2c2b33","#16151a","rosettes",1.05,"jungle","carn",1,2,31000,10,18,5],
/* ---------- CANINOS (10) ---------- */
["Lobo-cinzento|Grey wolf","canine","#9a9188","#4e463d","solid",.95,"forest","carn",3,8,15000,7,14,3],
["Lobo-guará|Maned wolf","canine","#d97b3c","#221a14","solid",.95,"grassland","omni",1,2,17000,7,13,2,{longLeg:1}],
["Raposa-vermelha|Red fox","canine","#e07a35","#f6f0e6","solid",.6,"forest","omni",1,4,6000,5,12,1,{tail:"bushy"}],
["Raposa-do-ártico|Arctic fox","canine","#f2f6f8","#d8e2e8","solid",.55,"tundra","carn",1,4,9500,7,11,1,{tail:"bushy"}],
["Fennec|Fennec fox","canine","#eed6a8","#f8eedc","solid",.4,"desert","omni",2,6,8500,7,12,1,{ear:"giant"}],
["Coiote|Coyote","canine","#a8916e","#5c4c38","solid",.8,"desert","omni",2,5,7000,5,13,2],
["Chacal-dourado|Golden jackal","canine","#c2a069","#6a5637","solid",.7,"savanna","omni",2,5,6500,5,12,2],
["Mabeco|African wild dog","canine","#c08540","#2e2620","patches",.85,"savanna","carn",4,12,19000,8,11,3],
["Dingo|Dingo","canine","#d2a166","#8a6a42","solid",.85,"desert","carn",2,6,9000,5,13,2],
["Cuon|Dhole","canine","#c4622f","#4a3020","solid",.8,"forest","carn",4,10,14000,7,12,3],
/* ---------- URSOS (8) ---------- */
["Urso-pardo|Brown bear","bear","#8b6440","#4e3722","solid",1.45,"forest","omni",1,2,32000,9,28,5],
["Urso-polar|Polar bear","bear","#f4f7f9","#dbe6ec","solid",1.55,"tundra","carn",1,2,48000,10,28,5,{swims:1}],
["Urso-negro|American black bear","bear","#33302e","#1c1a19","solid",1.3,"forest","omni",1,2,24000,7,25,4],
["Panda-gigante|Giant panda","bear","#f7f4ee","#25231f","patches",1.3,"mountain","herb",1,2,95000,10,22,2],
["Urso-de-óculos|Spectacled bear","bear","#3a332c","#d9c79a","mask",1.15,"mountain","omni",1,2,29000,8,24,3],
["Urso-preguiça|Sloth bear","bear","#2e2a26","#c9bfa8","solid",1.15,"jungle","inse",1,2,26000,7,22,4],
["Urso-malaio|Sun bear","bear","#302b26","#e0c184","mask",.95,"jungle","omni",1,2,27000,8,24,3],
["Urso-negro-asiático|Asian black bear","bear","#2b2724","#efe6cf","mask",1.25,"forest","omni",1,2,26000,7,25,4],
/* ---------- PRIMATAS (14) ---------- */
["Gorila-das-montanhas|Mountain gorilla","primate","#3b3833","#1e1c19","solid",1.5,"jungle","herb",3,10,120000,10,40,4,{back:"silver"}],
["Chimpanzé|Chimpanzee","primate","#3a332c","#c99a72","solid",1,"jungle","omni",4,12,68000,9,45,3],
["Bonobo|Bonobo","primate","#332e29","#b98d68","solid",.95,"jungle","omni",4,12,72000,9,42,2],
["Orangotango|Orangutan","primate","#b5551f","#7a3a14","solid",1.25,"jungle","frug",1,3,88000,10,38,3,{longArm:1}],
["Babuíno-sagrado|Hamadryas baboon","primate","#b0a294","#7a6a58","solid",.85,"savanna","omni",6,20,14000,6,30,3,{mane:.7}],
["Mandril|Mandrill","primate","#5e5347","#3f6fb0","face",.95,"jungle","omni",5,18,32000,9,28,3],
["Macaco-prego|Capuchin monkey","primate","#8a6a45","#e2d4b8","solid",.5,"jungle","omni",4,14,9000,6,40,1],
["Bugio|Howler monkey","primate","#a8551f","#6a3413","solid",.65,"jungle","herb",3,10,11000,6,20,1],
["Muriqui|Woolly spider monkey","primate","#a89476","#6a5a42","solid",.7,"jungle","herb",3,10,15000,7,25,1],
["Gibão|Gibbon","primate","#33302b","#d9c9a8","solid",.7,"jungle","frug",2,4,26000,8,35,1,{longArm:1}],
["Lêmure-de-cauda-anelada|Ring-tailed lemur","primate","#a8a49c","#efeae0","ringed",.5,"forest","frug",5,16,12000,8,18,1,{tail:"ringed"}],
["Sagui-de-tufos-brancos|Common marmoset","primate","#8a7f6e","#f2ede2","solid",.28,"jungle","inse",4,10,4500,6,14,1],
["Mico-leão-dourado|Golden lion tamarin","primate","#e8a02c","#c47a15","solid",.3,"jungle","frug",3,8,22000,9,16,1,{mane:.8}],
["Macaco-narigudo|Proboscis monkey","primate","#c4763c","#9a5528","solid",.85,"wetland","herb",4,14,42000,9,22,2],
/* ---------- UNGULATES: deer & antelope (13) ---------- */
["Cervo-vermelho|Red deer","ungulate","#a87a4a","#6a4a2c","solid",1,"forest","herb",4,14,7000,5,18,1,{horn:"branched",hornSize:1}],
["Alce|Moose","ungulate","#6a4f36","#3d2c1c","solid",1.5,"tundra","herb",1,4,19000,8,20,3,{horn:"palm",hornSize:1.3}],
["Rena|Reindeer","ungulate","#a89880","#5e5040","solid",1.05,"tundra","herb",6,25,13000,7,17,1,{horn:"branched",hornSize:1.1}],
["Veado-campeiro|Pampas deer","ungulate","#c49a68","#f2ece0","spots",.75,"grassland","herb",3,12,4500,4,14,1,{horn:"straight",hornSize:.5}],
["Gazela-de-thomson|Thomson's gazelle","ungulate","#d4a463","#2e2318","stripes",.65,"savanna","herb",6,25,4000,5,12,1,{horn:"straight",hornSize:.7}],
["Impala|Impala","ungulate","#cf9a58","#f0e6d4","solid",.8,"savanna","herb",6,25,4200,5,13,1,{horn:"lyre",hornSize:1}],
["Springbok|Springbok","ungulate","#d8a962","#6a4020","stripes",.7,"desert","herb",6,25,4400,5,12,1,{horn:"lyre",hornSize:.8}],
["Órix-da-arábia|Arabian oryx","ungulate","#f4f0e6","#3a2e22","mask",.95,"desert","herb",4,15,16000,8,18,2,{horn:"straight",hornSize:1.6}],
["Cudo-maior|Greater kudu","ungulate","#9a8464","#efe8da","stripes",1.25,"savanna","herb",3,12,15000,8,15,2,{horn:"spiral",hornSize:1.5}],
["Antílope-negro|Blackbuck","ungulate","#2e2620","#f2ece0","patches",.9,"grassland","herb",5,20,11000,7,16,1,{horn:"spiral",hornSize:1.4}],
["Gnu-azul|Blue wildebeest","ungulate","#6a6a70","#33322f","stripes",1.1,"savanna","herb",8,30,7500,6,18,2,{horn:"curved",hornSize:.8,mane:.5}],
["Bongo|Bongo","ungulate","#b5502a","#f4ede0","stripes",1.1,"jungle","herb",3,12,24000,9,17,2,{horn:"spiral",hornSize:1}],
["Nilgó|Nilgai","ungulate","#7d8288","#e8e2d4","solid",1.15,"grassland","herb",4,14,8500,5,15,2,{horn:"straight",hornSize:.5}],
/* ---------- BOVINOS (8) ---------- */
["Bisão-americano|American bison","bovine","#6a5540","#3a2c1e","solid",1.5,"grassland","herb",5,20,18000,8,20,3,{horn:"curved",hornSize:.7,mane:1}],
["Búfalo-africano|African buffalo","bovine","#3f3a34","#221f1b","solid",1.45,"savanna","herb",6,25,16000,7,22,4,{horn:"boss",hornSize:1.2}],
["Búfalo-asiático|Water buffalo","bovine","#4a4640","#2b2724","solid",1.5,"wetland","herb",4,16,12000,6,25,3,{horn:"moon",hornSize:1.6}],
["Iaque|Yak","bovine","#3a332c","#6a5b48","solid",1.35,"mountain","herb",4,15,14000,7,22,2,{horn:"moon",hornSize:.9,furry:1}],
["Gaur|Gaur","bovine","#3a2c22","#d9cdb6","solid",1.6,"jungle","herb",4,15,22000,8,26,3,{horn:"moon",hornSize:1.1}],
["Boi-almiscarado|Musk ox","bovine","#4a3a2c","#241c14","solid",1.3,"tundra","herb",5,18,21000,8,20,3,{horn:"boss",hornSize:1,furry:1}],
["Vaca-highland|Highland cattle","bovine","#c47a2c","#8a5218","solid",1.2,"mountain","herb",3,12,6500,5,20,1,{horn:"moon",hornSize:1.5,furry:1}],
["Banteng|Banteng","bovine","#8a5a2c","#f2ece0","patches",1.35,"jungle","herb",4,16,15000,7,24,3,{horn:"moon",hornSize:1}],
/* ---------- EQUINOS (5) ---------- */
["Zebra-de-planície|Plains zebra","equine","#f4f1e8","#221f1c","stripes",1.05,"savanna","herb",4,18,14000,8,25,2,{mane:.9}],
["Zebra-de-grevy|Grévy's zebra","equine","#f6f3ea","#26221e","stripes",1.15,"savanna","herb",4,16,19000,9,26,2,{mane:1,ear:"giant"}],
["Cavalo-de-przewalski|Przewalski's horse","equine","#c49a5e","#4a3a26","solid",1.05,"grassland","herb",4,15,23000,8,24,2,{mane:.7}],
["Onagro|Onager","equine","#c9a875","#7a6248","solid",1,"desert","herb",4,14,11000,6,22,2,{mane:.5}],
["Kiang|Kiang","equine","#b5622c","#f2ece0","solid",1.1,"mountain","herb",4,16,12500,6,22,2,{mane:.6}],
/* ---------- ELEFANTES (3) ---------- */
["Elefante-africano|African elephant","elephant","#8f8c88","#6a6763","solid",2.1,"savanna","herb",3,10,140000,10,60,4,{ear:"giant",tusk:1.3}],
["Elefante-asiático|Asian elephant","elephant","#8a8480","#6a6560","solid",1.9,"jungle","herb",3,10,120000,10,60,4,{ear:"medium",tusk:.8}],
["Elefante-da-floresta|Forest elephant","elephant","#7d7a76","#5e5b57","solid",1.7,"jungle","herb",3,8,135000,10,55,4,{ear:"medium",tusk:1.1}],
/* ---------- GIRAFFIDS (2) ---------- */
["Girafa-masai|Masai giraffe","giraffe","#e0b055","#8a5a26","spots",2.2,"savanna","herb",3,12,95000,10,26,2],
["Okapi|Okapi","giraffe","#7a3f24","#f2ece0","zebra",1.15,"jungle","herb",1,3,72000,9,25,2,{neck:.45}],
/* ---------- RINOCERONTES (4) ---------- */
["Rinoceronte-branco|White rhinoceros","rhino","#a5a29c","#8a8781","solid",1.85,"savanna","herb",2,8,110000,9,45,4,{prong:1.3}],
["Rinoceronte-negro|Black rhinoceros","rhino","#7d7a74","#5e5b56","solid",1.65,"savanna","herb",1,3,125000,9,42,5,{prong:1.5}],
["Rinoceronte-indiano|Indian rhinoceros","rhino","#8a8782","#6a6762","plates",1.8,"wetland","herb",1,4,130000,10,45,4,{prong:.7,plates:1}],
["Rinoceronte-de-java|Javan rhinoceros","rhino","#83807a","#63605b","plates",1.6,"jungle","herb",1,2,180000,10,40,4,{prong:.5,plates:1}],
/* ---------- HIPPOS (2) ---------- */
["Hipopótamo|Hippopotamus","hippo","#9a7a80","#7a5c62","solid",1.7,"wetland","herb",3,12,72000,9,45,5,{swims:1}],
["Hipopótamo-pigmeu|Pygmy hippopotamus","hippo","#5e5048","#4a3e37","solid",.85,"jungle","herb",1,3,52000,8,40,3,{swims:1}],
/* ---------- CAMELIDS (6) ---------- */
["Camelo-bactriano|Bactrian camel","camelid","#c9a266","#8a6a3f","solid",1.5,"desert","herb",3,12,26000,8,45,2,{hump:2}],
["Dromedário|Dromedary","camelid","#d9b478","#a88a52","solid",1.5,"desert","herb",3,12,18000,7,45,2,{hump:1}],
["Lhama|Llama","camelid","#e8dcc4","#a8906a","patches",.95,"mountain","herb",4,14,5500,5,22,1,{hump:0,furry:1}],
["Alpaca|Alpaca","camelid","#f2e8d4","#c9b590","solid",.8,"mountain","herb",4,16,6500,6,20,1,{hump:0,furry:1.4}],
["Vicunha|Vicuña","camelid","#d9a86e","#f4ede0","solid",.8,"mountain","herb",5,18,14000,7,20,1,{hump:0}],
["Guanaco|Guanaco","camelid","#c99a62","#f2ece0","solid",.95,"mountain","herb",4,16,9000,6,22,1,{hump:0}],
/* ---------- SWINE (5) ---------- */
["Facóquero|Warthog","swine","#8a7a68","#5e5145","solid",.85,"savanna","omni",3,12,6000,5,15,2,{tusk:1,mane:.8}],
["Javali-europeu|Wild boar","swine","#5e5148","#3a322c","solid",.95,"forest","omni",3,14,5500,4,14,3,{tusk:.8,mane:.5}],
["Babirussa|Babirusa","swine","#9a8f80","#6a6156","solid",.85,"jungle","omni",2,8,17000,8,18,2,{tusk:1.6}],
["Queixada|White-lipped peccary","swine","#4a453e","#e8e2d4","solid",.65,"jungle","omni",5,20,4000,4,12,2],
["Porco-do-mato-vermelho|Red river hog","swine","#c4642c","#f2ece0","stripes",.8,"jungle","omni",4,14,7500,6,15,2,{ear:"tuft"}],
/* ---------- ROEDORES (9) ---------- */
["Capivara|Capybara","rodent","#a8794a","#7a5836","solid",.85,"wetland","herb",5,20,5000,6,10,1,{swims:1}],
["Castor|Beaver","rodent","#7a5638","#4e3a26","solid",.6,"forest","herb",2,8,7000,6,16,1,{swims:1,tail:"paddle"}],
["Porco-espinho|Porcupine","rodent","#4a423a","#e8e2d4","spine",.6,"forest","herb",1,4,4500,5,18,2,{spine:1}],
["Cão-da-pradaria|Prairie dog","rodent","#c9a875","#8a7250","solid",.28,"grassland","herb",8,40,1800,4,8,1],
["Cutia|Agouti","rodent","#8a6a45","#5e4a30","solid",.35,"jungle","herb",2,8,2200,3,12,1],
["Chinchila|Chinchilla","rodent","#a8a49c","#e2ded6","solid",.28,"mountain","herb",4,14,3200,5,15,1,{tail:"bushy"}],
["Marmota|Marmot","rodent","#8a7050","#5e4a34","solid",.42,"mountain","herb",3,12,2600,4,13,1],
["Esquilo-gigante|Giant squirrel","rodent","#a8410f","#f2c96e","patches",.32,"jungle","frug",2,8,4800,6,18,1,{tail:"bushy"}],
["Paca|Paca","rodent","#8a6a4a","#f2ece0","spots",.45,"jungle","herb",1,4,2800,4,13,1],
/* ---------- MARSUPIAIS (7) ---------- */
["Canguru-vermelho|Red kangaroo","kangaroo","#c4764a","#f0e6d8","solid",1.15,"desert","herb",5,20,16000,8,22,2],
["Canguru-cinzento|Grey kangaroo","kangaroo","#9a9088","#e2dcd2","solid",1.05,"grassland","herb",5,20,13000,7,20,2],
["Wallaby|Wallaby","kangaroo","#a87a58","#e0d4c4","solid",.6,"forest","herb",4,16,7500,6,14,1],
["Coala|Koala","rodent","#a5a8ac","#f0f2f4","solid",.55,"forest","herb",1,4,45000,10,18,1,{ear:"giant",tail:"none",climber:1}],
["Wombat|Wombat","rodent","#8a7460","#5e4e40","solid",.6,"forest","herb",1,3,14000,7,20,1,{tail:"none"}],
["Diabo-da-tasmânia|Tasmanian devil","mustelid","#26221f","#f2ece0","patches",.5,"forest","carn",1,4,28000,9,7,3],
["Gambá|Opossum","mustelid","#8a8580","#e2ded6","solid",.45,"forest","omni",1,4,2400,3,4,1,{tail:"bare"}],
/* ---------- XENARTROS (5) ---------- */
["Preguiça-de-três-dedos|Three-toed sloth","sloth","#9a9078","#6a6250","solid",.6,"jungle","herb",1,3,26000,9,30,1,{climber:1}],
["Preguiça-de-dois-dedos|Two-toed sloth","sloth","#a89878","#7a6c52","solid",.65,"jungle","herb",1,3,24000,8,30,1,{climber:1}],
["Tamanduá-bandeira|Giant anteater","sloth","#4a453e","#e8e2d4","patches",.95,"grassland","inse",1,2,22000,8,16,2,{longSnout:1,tail:"banner"}],
["Tatu-canastra|Giant armadillo","sloth","#8a7f6e","#5e564a","plates",.8,"grassland","inse",1,2,32000,9,15,1,{plates:1}],
["Tatu-bola|Three-banded armadillo","sloth","#9a8a70","#6a5e4a","plates",.35,"savanna","inse",1,4,12000,7,14,1,{plates:1}],
/* ---------- AVES TERRESTRES (8) ---------- */
["Avestruz|Ostrich","bird","#33302c","#f2ece0","solid",1.5,"savanna","omni",2,10,12000,7,45,3,{longLeg:1.5,neck:1.4,beak:"straight"}],
["Ema|Rhea","bird","#a89c88","#7a7062","solid",1.2,"grassland","omni",2,10,6500,5,30,2,{longLeg:1.3,neck:1.3}],
["Emu|Emu","bird","#6a6054","#4a4238","solid",1.25,"desert","omni",2,8,7500,6,25,2,{longLeg:1.3,neck:1.2}],
["Casuar|Cassowary","bird","#26262a","#2f7fc4","crest",1.25,"jungle","frug",1,2,34000,9,40,4,{longLeg:1.2,neck:1.1,crest:1.4}],
["Pavão-azul|Indian peafowl","bird","#1f5fa8","#2fa87a","tail",.6,"jungle","omni",2,10,5500,8,20,1,{tail:"fan",crest:.6}],
["Grou-coroado|Crowned crane","bird","#6a6a6a","#e8c93c","crest",.9,"wetland","omni",2,8,14000,8,22,1,{longLeg:1.4,neck:1.2,crest:1.2}],
["Cegonha|White stork","bird","#f4f2ec","#26221f","patches",.9,"wetland","pisc",2,10,7000,6,25,1,{longLeg:1.4,neck:1.2,beak:"long"}],
["Secretário|Secretarybird","bird","#b5b0a6","#26221f","crest",1,"savanna","carn",1,2,19000,8,20,2,{longLeg:1.7,crest:1}],
/* ---------- AVES VOADORAS (12) ---------- */
["Águia-careca|Bald eagle","bird","#4a3826","#f6f4ee","whiteHead",.75,"mountain","carn",1,2,32000,9,25,3,{flies:1,beak:"hooked",wing:1.3}],
["Harpia|Harpy eagle","bird","#5e5b56","#e2ded6","crest",.85,"jungle","carn",1,2,44000,10,30,3,{flies:1,beak:"hooked",crest:.9,wing:1.2}],
["Arara-azul|Hyacinth macaw","bird","#2f5fc4","#e8c93c","solid",.6,"jungle","frug",2,8,26000,9,50,1,{flies:1,beak:"hooked",tail:"long"}],
["Arara-vermelha|Scarlet macaw","bird","#d63a2a","#2f7fc4","solid",.6,"jungle","frug",2,8,22000,9,50,1,{flies:1,beak:"hooked",tail:"long"}],
["Tucano-toco|Toco toucan","bird","#26221f","#f2a01c","bigBeak",.45,"jungle","frug",2,8,14000,9,20,1,{flies:1,beak:"toucan"}],
["Coruja-das-neves|Snowy owl","bird","#f6f6f2","#c9c4bc","spots",.55,"tundra","carn",1,2,18000,9,20,2,{flies:1,beak:"hooked",nocturnal:1,bigEye:1}],
["Falcão-peregrino|Peregrine falcon","bird","#5e6a76","#f0ece2","stripes",.4,"mountain","carn",1,2,15000,8,16,2,{flies:1,beak:"hooked"}],
["Condor-dos-andes|Andean condor","bird","#26262a","#f4f2ec","collar",1,"mountain","carn",1,3,38000,9,50,2,{flies:1,beak:"hooked",wing:1.6,baldHead:"#c98a5e"}],
["Abutre-fouveiro|Griffon vulture","bird","#8a7f6e","#e8e2d4","collar",.8,"savanna","carn",3,12,11000,6,35,2,{flies:1,beak:"hooked",baldHead:"#d9b8a0"}],
["Calau-bicórnio|Great hornbill","bird","#26221f","#f2d43c","bigBeak",.6,"jungle","frug",2,6,24000,9,35,1,{flies:1,beak:"hornbill"}],
["Cacatua-galerita|Sulphur-crested cockatoo","bird","#f8f6ee","#f2d43c","crest",.42,"jungle","frug",3,12,9000,7,60,1,{flies:1,beak:"hooked",crest:1.1}],
["Quetzal|Resplendent quetzal","bird","#1fa87a","#d63a2a","tail",.35,"jungle","frug",2,6,29000,10,20,1,{flies:1,tail:"plume",crest:.5}],
/* ---------- PINGUINS (6) ---------- */
["Pinguim-imperador|Emperor penguin","penguin","#2b2b30","#f6f4ee","ruff",.85,"tundra","pisc",8,40,24000,10,20,1,{swims:1,ruff:"#f2c93c"}],
["Pinguim-rei|King penguin","penguin","#3a3a40","#f6f4ee","ruff",.7,"tundra","pisc",8,40,19000,9,22,1,{swims:1,ruff:"#f2a81c"}],
["Pinguim-de-humboldt|Humboldt penguin","penguin","#33333a","#f4f2ec","ruff",.5,"coast","pisc",6,30,9000,7,18,1,{swims:1}],
["Pinguim-gentoo|Gentoo penguin","penguin","#2f2f36","#f6f4ee","ruff",.55,"tundra","pisc",6,30,11000,8,18,1,{swims:1,ruff:"#e85a2a"}],
["Pinguim-saltador-de-rocha|Rockhopper penguin","penguin","#2b2b32","#f6f4ee","crest",.4,"coast","pisc",6,30,13000,9,15,1,{swims:1,crest:1.2,ruff:"#f2c93c"}],
["Pinguim-de-magalhães|Magellanic penguin","penguin","#33333a","#f4f2ec","ruff",.45,"coast","pisc",6,30,8000,7,20,1,{swims:1}],
/* ---------- PERNALTAS (6) ---------- */
["Flamingo-rosa|Greater flamingo","wader","#f47ba8","#e8447f","solid",.75,"wetland","pisc",10,60,9000,9,30,1,{longLeg:1.8,neck:1.6,beak:"curved"}],
["Íbis-escarlate|Scarlet ibis","wader","#e8351f","#26221f","solid",.5,"wetland","pisc",8,40,12000,9,20,1,{longLeg:1.4,neck:1.3,beak:"curved"}],
["Garça-real|Grey heron","wader","#b8bcc0","#f2ece0","solid",.7,"wetland","pisc",2,12,6000,6,22,1,{longLeg:1.5,neck:1.5,beak:"long"}],
["Colhereiro|Roseate spoonbill","wader","#f2a8c0","#e8709a","solid",.6,"wetland","pisc",6,30,10000,8,15,1,{longLeg:1.4,neck:1.3,beak:"spoon"}],
["Pelicano-branco|Great white pelican","wader","#f4f2ec","#f2b01c","solid",.85,"coast","pisc",5,25,8500,7,25,1,{neck:1,beak:"pouch",swims:1}],
["Jabiru|Jabiru","wader","#f6f4ee","#26221f","ruff",1,"wetland","pisc",2,10,16000,8,30,1,{longLeg:1.6,neck:1.4,beak:"long",ruff:"#d63a2a"}],
/* ---------- LAGARTOS (7) ---------- */
["Dragão-de-komodo|Komodo dragon","lizard","#6a6258","#4a443c","solid",1.1,"desert","carn",1,3,68000,10,30,5],
["Iguana-verde|Green iguana","lizard","#5eb04a","#3f8a33","bands",.55,"jungle","herb",2,8,3500,5,20,1,{crest:1}],
["Camaleão-de-jackson|Jackson's chameleon","lizard","#7ac44a","#4a8a2c","bands",.28,"jungle","inse",1,3,6500,7,10,1,{prong:1,tail:"spiral"}],
["Varano-do-nilo|Nile monitor","lizard","#5e5a50","#c9bfa0","spots",.8,"wetland","carn",1,3,9000,6,20,3],
["Monstro-de-gila|Gila monster","lizard","#e8843c","#26221f","patches",.35,"desert","carn",1,2,14000,7,25,3],
["Teiú|Tegu","lizard","#4a4a44","#e8e2d4","bands",.5,"savanna","omni",1,4,4200,4,15,1],
["Clamidossauro|Frilled lizard","lizard","#a8763c","#e8c98a","solid",.4,"desert","inse",1,4,8500,7,12,1,{collar:1}],
/* ---------- CROCODILIANOS (4) ---------- */
["Crocodilo-do-nilo|Nile crocodile","lizard","#5e6250","#3f4436","plates",1.5,"wetland","carn",1,6,42000,9,70,5,{croc:1,swims:1}],
["Jacaré-do-pantanal|Yacare caiman","lizard","#4a5040","#333a2c","plates",1,"wetland","carn",2,10,14000,7,50,4,{croc:1,swims:1}],
["Gavial-do-ganges|Gharial","lizard","#5a6258","#3d443c","plates",1.4,"wetland","pisc",1,5,54000,9,60,3,{croc:1,swims:1,longSnout:1.6}],
["Crocodilo-de-água-salgada|Saltwater crocodile","lizard","#565c4a","#3a4032","plates",1.8,"wetland","carn",1,3,72000,10,70,5,{croc:1,swims:1}],
/* ---------- SERPENTES (6) ---------- */
["Píton-reticulada|Reticulated python","snake","#c9a86a","#5e4a2c","net",1.2,"jungle","carn",1,2,16000,8,25,4],
["Sucuri-verde|Green anaconda","snake","#5a6a3a","#2f3a20","spots",1.4,"wetland","carn",1,2,22000,9,30,4,{swims:1}],
["Naja-real|King cobra","snake","#7a6a4a","#4a3e2a","solid",.9,"jungle","carn",1,2,26000,9,20,5,{hood:1}],
["Jiboia-constritora|Boa constrictor","snake","#c4a882","#7a5a3a","patches",.9,"jungle","carn",1,3,7500,6,25,3],
["Cascavel-diamante|Diamondback rattlesnake","snake","#b5a06a","#5e4e30","diamond",.7,"desert","carn",1,3,11000,7,20,5,{rattle:1}],
["Mamba-negra|Black mamba","snake","#4a4a48","#33332f","solid",.85,"savanna","carn",1,2,29000,9,15,5],
/* ---------- CHELONIANS (5) ---------- */
["Tartaruga-de-galápagos|Galápagos tortoise","turtle","#6a6254","#4a443a","shell",1.15,"desert","herb",2,10,44000,9,120,1],
["Jabuti-piranga|Red-footed tortoise","turtle","#4a453c","#e8843c","shell",.45,"jungle","herb",2,10,3800,4,60,1],
["Tartaruga-verde|Green sea turtle","turtle","#5a7a52","#3f5a3a","shell",.9,"aquarium","herb",2,8,26000,9,80,1,{swims:1,flipper:1}],
["Tartaruga-mordedora|Snapping turtle","turtle","#4a4a40","#33332c","shell",.6,"wetland","carn",1,4,6500,5,45,3],
["Tartaruga-de-esporão|African spurred tortoise","turtle","#a8946a","#7a6a48","shell",.7,"desert","herb",2,8,9500,6,70,1],
/* ---------- AMPHIBIANS (6) ---------- */
["Rã-flecha-azul|Blue poison dart frog","amphibian","#2f7fe8","#1f4aa8","spots",.14,"jungle","inse",4,20,4500,8,8,4],
["Sapo-cururu|Cane toad","amphibian","#8a7a58","#5e5238","spots",.24,"jungle","inse",2,10,900,2,12,2],
["Axolote|Axolotl","amphibian","#f2b0c0","#e88aa0","solid",.2,"aquarium","carn",3,12,7500,8,12,1,{swims:1,gills:1}],
["Salamandra-de-fogo|Fire salamander","amphibian","#26221f","#f2c81c","patches",.18,"forest","inse",2,8,3200,6,20,1],
["Perereca-de-olhos-vermelhos|Red-eyed tree frog","amphibian","#5ec44a","#e8351f","solid",.12,"jungle","inse",4,16,3800,7,8,1,{bigEye:1}],
["Rã-touro|Bullfrog","amphibian","#5a7a4a","#3f5a33","spots",.26,"wetland","carn",3,14,1200,2,10,1],
/* ---------- PEIXES & CIA (8) ---------- */
["Tubarão-branco|Great white shark","fish","#7d8890","#f2f2ee","solid",1.9,"aquarium","carn",1,3,180000,10,45,5,{swims:1,dorsal:1.3}],
["Tubarão-tigre|Tiger shark","fish","#6a7a84","#e8e8e2","stripes",1.6,"aquarium","carn",1,3,120000,9,35,5,{swims:1,dorsal:1.2}],
["Arraia-manta|Manta ray","fish","#3a4048","#f2f2ee","ray",1.7,"aquarium","pisc",1,4,95000,10,45,1,{swims:1,ray:1}],
["Piranha-vermelha|Red piranha","fish","#8a9098","#e8451f","solid",.16,"wetland","carn",8,40,1400,6,15,3,{swims:1}],
["Pirarucu|Arapaima","fish","#5a6250","#c4402c","scale",1.4,"wetland","pisc",1,4,32000,8,20,2,{swims:1}],
["Peixe-palhaço|Clownfish","fish","#f28422","#f6f4ee","stripes",.1,"aquarium","omni",6,30,600,5,10,1,{swims:1}],
["Carpa-koi|Koi carp","fish","#f6f2e8","#e8621f","patches",.3,"aquarium","omni",5,25,2400,5,40,1,{swims:1}],
["Peixe-lua|Ocean sunfish","fish","#9aa0a8","#d2d6da","solid",1.5,"aquarium","omni",1,3,62000,9,20,1,{swims:1,spring:1}],
/* ---------- CETACEANS (4) ---------- */
["Golfinho-nariz-de-garrafa|Bottlenose dolphin","fish","#8a949c","#e2e6ea","solid",1.25,"aquarium","pisc",4,16,140000,10,45,2,{swims:1,dolphin:1}],
["Orca|Orca","fish","#26262c","#f6f4ee","patches",2,"aquarium","carn",3,10,320000,10,60,4,{swims:1,dolphin:1,dorsal:1.6}],
["Beluga|Beluga","fish","#eef2f4","#d8e0e6","solid",1.6,"aquarium","pisc",3,12,190000,10,50,1,{swims:1,dolphin:1,dorsal:0}],
["Boto-cor-de-rosa|Amazon river dolphin","fish","#f0a8b8","#e88a9e","solid",1.2,"wetland","pisc",2,8,110000,10,35,1,{swims:1,dolphin:1,longSnout:1.4}],
/* ---------- PINNIPEDS (5) ---------- */
["Foca-comum|Harbour seal","seal","#8a8a84","#c9c9c0","spots",.85,"coast","pisc",5,20,18000,8,30,1,{swims:1}],
["Leão-marinho-da-califórnia|California sea lion","seal","#6a5442","#a8886a","solid",1.05,"coast","pisc",5,25,26000,9,25,2,{swims:1,mane:.6}],
["Morsa|Walrus","seal","#a8785e","#7a5440","solid",1.7,"tundra","pisc",4,16,58000,10,40,3,{swims:1,tusk:1.6,whiskers:1}],
["Foca-leopardo|Leopard seal","seal","#6a7078","#c4c9ce","spots",1.35,"tundra","carn",1,3,48000,9,26,4,{swims:1}],
["Lobo-marinho|Fur seal","seal","#4a3a2c","#7a6248","solid",.9,"coast","pisc",6,30,21000,8,25,2,{swims:1,mane:.4}],
/* ---------- MUSTELIDS & SMALL CARNIVORES (12) ---------- */
["Lontra-gigante|Giant otter","mustelid","#5e422c","#e8dcc4","ruff",.85,"wetland","pisc",4,14,34000,9,15,2,{swims:1}],
["Lontra-europeia|European otter","mustelid","#6a4e34","#c9b596","solid",.5,"forest","pisc",3,10,14000,8,12,1,{swims:1}],
["Texugo-europeu|European badger","mustelid","#8a8a84","#26221f","mask",.5,"forest","omni",2,8,5500,5,12,2],
["Carcaju|Wolverine","mustelid","#4a3a2c","#c98a3c","ruff",.6,"tundra","carn",1,2,26000,8,13,4],
["Furão|Ferret","mustelid","#e8dcc0","#4a3a2c","mask",.3,"grassland","carn",2,8,2600,4,8,1],
["Ratel|Honey badger","mustelid","#26221f","#f0ece0","patches",.45,"savanna","omni",1,3,22000,9,14,4],
["Mangusto-anão|Dwarf mongoose","mustelid","#8a7454","#5e4e38","solid",.2,"savanna","inse",6,25,1900,5,10,1],
["Suricato|Meerkat","mustelid","#c9b088","#8a7050","stripes",.28,"desert","inse",8,30,4200,8,12,1,{upright:1}],
["Guaxinim|Raccoon","mustelid","#8a8a86","#26221f","mask",.45,"forest","omni",2,8,3400,6,14,1,{tail:"ringed"}],
["Panda-vermelho|Red panda","mustelid","#c4551f","#26221f","mask",.45,"mountain","herb",1,4,52000,10,16,1,{tail:"ringed",climber:1}],
["Gambá-listrado|Striped skunk","mustelid","#26221f","#f4f2ec","stripes",.35,"forest","omni",1,4,2800,5,7,1,{tail:"bushy"}],
["Quati|Coati","mustelid","#8a6a48","#4a3826","solid",.42,"jungle","omni",5,20,3600,6,14,1,{tail:"ringed",longSnout:1.2}],
/* ---------- MORCEGOS (3) ---------- */
["Raposa-voadora|Flying fox","bat","#4a3526","#8a6a48","solid",.4,"jungle","frug",8,40,9500,8,25,1,{flies:1,nocturnal:1}],
["Morcego-vampiro|Vampire bat","bat","#3a2f26","#5e4a38","solid",.16,"cave","carn",10,60,12000,9,20,2,{flies:1,nocturnal:1}],
["Morcego-frugívoro-egípcio|Egyptian fruit bat","bat","#6a5842","#a8906a","solid",.2,"cave","frug",12,80,5500,6,22,1,{flies:1,nocturnal:1}],
/* ---------- INVERTEBRADOS (6) ---------- */
["Tarântula-golias|Goliath birdeater","insect","#5e3a24","#3a2418","solid",.16,"jungle","carn",1,2,3800,7,20,2,{spider:1}],
["Escorpião-imperador|Emperor scorpion","insect","#26262c","#3a3a44","solid",.14,"savanna","carn",1,4,2600,6,8,2,{scorpion:1}],
["Besouro-hércules|Hercules beetle","insect","#33302a","#c9a84a","solid",.12,"jungle","frug",2,10,1900,6,2,1,{beetle:1}],
["Borboleta-morfo-azul|Blue morpho butterfly","insect","#2f6fe8","#1f4aa8","solid",.1,"jungle","frug",10,60,900,7,1,1,{butterfly:1,flies:1}],
["Louva-a-deus-orquídea|Orchid mantis","insect","#f4e2ee","#e8a8c8","solid",.1,"jungle","inse",2,8,1600,7,1,1,{mantis:1}],
["Bicho-pau-gigante|Giant stick insect","insect","#7a6a4a","#5a4e38","solid",.16,"jungle","herb",3,14,1200,5,2,1,{stick:1}],
/* ---------- WATERFOWL (6) ---------- */
["Cisne-negro|Black swan","bird","#33333a","#d63a2a","solid",.65,"wetland","herb",2,12,5200,7,25,1,{neck:1.6,swims:1,beak:"duck"}],
["Cisne-branco|Mute swan","bird","#f8f6f0","#f2a81c","solid",.7,"wetland","herb",2,12,4800,7,25,1,{neck:1.7,swims:1,beak:"duck"}],
["Pato-mandarim|Mandarin duck","bird","#e8843c","#2f7fa8","solid",.28,"wetland","omni",4,20,2200,7,10,1,{swims:1,beak:"duck",crest:.7}],
["Ganso-do-canadá|Canada goose","bird","#5e5548","#26221f","ruff",.5,"wetland","herb",6,30,1800,4,20,1,{neck:1.3,swims:1,beak:"duck"}],
["Papagaio-do-mar|Atlantic puffin","bird","#26262a","#f4f2ec","whiteHead",.28,"coast","pisc",8,40,8500,8,20,1,{beak:"puffin",swims:1}],
["Marreco-carolino|Wood duck","bird","#2f8a6a","#e8a83c","solid",.26,"wetland","omni",4,20,2000,6,12,1,{swims:1,beak:"duck",crest:.6}],
];

/* ---- Builds the catalogue with its derived fields ---- */
const SPECIES = SPECIES_RAW.map((r, i) => {
  const [name, plan, c1, c2, pattern, scale, biome, diet, groupMin, groupMax, price, appeal, lifespan, danger, options] = r;
  const opts = options || {};
  const B = BIOMES[biome];
  return {
    id: i, name, plan, c1, c2, pattern, scale, biome, diet,
    groupMin, groupMax, price, appeal, lifespan, danger, o: opts,
    // The Portuguese side of the name is the species' stable identity: it seeds
    // the drawing (`hashStr(sp.key)`), so an animal looks the same whichever
    // flag is up. Seeding from the displayed name would redraw all 219 the
    // moment somebody switched language.
    key: KEY(name),
    slug: KEY(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-'),
    space: Math.max(2, Math.round(2 + scale * scale * 5)),        // tiles per individual
    feed: +(DIETS[diet].cost * (0.35 + scale * 0.85)).toFixed(1), // per day
    aquatic: !!opts.swims && (biome === 'aquarium' || plan === 'fish' || plan === 'seal'),
    flies: !!opts.flies,
    mix: B.mix, temp: B.temp,
    biomeName: B.n, dietName: DIETS[diet].n,
    // the box-office value the species adds
    draw: +(appeal * (0.6 + scale * 0.4)).toFixed(2),
  };
});
const SPECIES_BY_BIOME = {};
SPECIES.forEach(s => (SPECIES_BY_BIOME[s.biome] ||= []).push(s));