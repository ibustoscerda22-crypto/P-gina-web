// Catálogo de ejercicios y plan de entrenamiento (mismo contenido que la app de iOS).

const CATEGORIAS = {
  empuje: { nombre: "Empuje", icono: "💪" },
  traccion: { nombre: "Tracción", icono: "🧗" },
  piernas: { nombre: "Piernas", icono: "🦵" },
  core: { nombre: "Core", icono: "🔥" },
  movilidad: { nombre: "Movilidad", icono: "🤸" },
};

const EJERCICIOS = [
  // Movilidad / calentamiento
  {
    id: "circulos_brazos", nombre: "Círculos de brazos", categoria: "movilidad",
    resumen: "Calienta y lubrica los hombros antes de empujar o colgarte.",
    musculos: ["Hombros"],
    pasos: [
      "De pie, brazos estirados a los lados a la altura de los hombros.",
      "Haz círculos pequeños hacia adelante y ve agrandándolos.",
      "A mitad de tiempo cambia de dirección (hacia atrás).",
    ],
    errores: ["Encoger los hombros hacia las orejas.", "Moverte tan rápido que pierdes el control."],
  },
  {
    id: "saltos_tijera", nombre: "Saltos de tijera", categoria: "movilidad",
    resumen: "Sube las pulsaciones y calienta todo el cuerpo.",
    musculos: ["Cuerpo completo", "Cardio"],
    pasos: [
      "Pies juntos y brazos a los lados.",
      "Salta abriendo las piernas mientras subes los brazos por sobre la cabeza.",
      "Salta de vuelta a la posición inicial. Mantén un ritmo cómodo.",
      "Sin saltar: abre una pierna a la vez (versión de bajo impacto).",
    ],
    errores: ["Caer con las rodillas rígidas: aterriza suave."],
  },
  {
    id: "gato_camello", nombre: "Gato-camello", categoria: "movilidad",
    resumen: "Moviliza la columna y prepara el core.",
    musculos: ["Espalda", "Core"],
    pasos: [
      "En cuatro apoyos: manos bajo hombros, rodillas bajo caderas.",
      "Exhala y redondea la espalda llevando el mentón al pecho (gato).",
      "Inhala y arquea suavemente, mirando al frente (camello).",
      "Muévete lento, siguiendo la respiración.",
    ],
    errores: ["Forzar el arco de la zona lumbar."],
  },

  // Empuje
  {
    id: "flexion_pared", nombre: "Flexión en pared", categoria: "empuje",
    resumen: "El primer escalón de las flexiones. Ideal si hoy no puedes hacer ninguna.",
    musculos: ["Pecho", "Tríceps", "Hombros"],
    pasos: [
      "Párate a un brazo de distancia de una pared.",
      "Apoya las manos a la altura del pecho, un poco más abiertas que los hombros.",
      "Con el cuerpo recto, dobla los codos y acerca el pecho a la pared.",
      "Empuja hasta estirar los brazos.",
    ],
    errores: ["Doblar la cadera.", "Abrir los codos a 90°: llévalos a unos 45° del cuerpo."],
    masDificil: "flexion_inclinada",
  },
  {
    id: "flexion_inclinada", nombre: "Flexión inclinada", categoria: "empuje",
    resumen: "Manos sobre un mueble firme (mesa, banco, escalón). Más bajo = más difícil.",
    musculos: ["Pecho", "Tríceps", "Hombros"],
    pasos: [
      "Apoya las manos en el borde de una superficie estable a la altura de la cadera.",
      "Lleva los pies atrás hasta que el cuerpo forme una línea recta.",
      "Baja el pecho hasta casi tocar el borde, codos a unos 45°.",
      "Empuja fuerte hasta estirar los brazos, sin perder la línea.",
    ],
    errores: ["Que la cadera se hunda.", "Hacer la bajada a medias."],
    masFacil: "flexion_pared", masDificil: "flexion_rodillas",
  },
  {
    id: "flexion_rodillas", nombre: "Flexión de rodillas", categoria: "empuje",
    resumen: "Flexión en el suelo apoyando las rodillas, para ir construyendo fuerza.",
    musculos: ["Pecho", "Tríceps", "Hombros", "Core"],
    pasos: [
      "Manos en el suelo bajo los hombros, rodillas apoyadas (usa algo blando).",
      "Rodillas, cadera y hombros en línea recta, sin quedar con el trasero arriba.",
      "Baja hasta que el pecho quede a un puño del suelo.",
      "Empuja el suelo para subir.",
    ],
    errores: ["Doblar la cadera en vez de mantener la línea.", "Dejar caer la cabeza."],
    masFacil: "flexion_inclinada", masDificil: "flexion",
  },
  {
    id: "flexion", nombre: "Flexión completa", categoria: "empuje",
    resumen: "El clásico. Cuerpo como tabla, del talón a la cabeza.",
    musculos: ["Pecho", "Tríceps", "Hombros", "Core"],
    pasos: [
      "Posición de plancha alta: manos bajo los hombros, piernas estiradas.",
      "Aprieta glúteos y abdomen para que el cuerpo no se doble.",
      "Baja controlado (2 segundos) hasta casi tocar el suelo con el pecho.",
      "Empuja hasta estirar los brazos por completo.",
    ],
    errores: ["Cadera hundida o muy arriba.", "Codos abiertos en T.", "Recorrido incompleto."],
    masFacil: "flexion_rodillas", masDificil: "flexion_pike",
  },
  {
    id: "fondos_banco", nombre: "Fondos en banco", categoria: "empuje",
    resumen: "Tríceps con una silla o banco firme detrás de ti.",
    musculos: ["Tríceps", "Hombros", "Pecho"],
    pasos: [
      "Siéntate en el borde de una silla estable (contra la pared) y apoya las manos junto a la cadera.",
      "Desliza la cadera hacia adelante; rodillas dobladas para que sea más fácil.",
      "Dobla los codos hacia atrás hasta unos 90°.",
      "Empuja para subir. Piernas estiradas = más difícil.",
    ],
    errores: ["Bajar demasiado y forzar el hombro.", "Abrir los codos hacia los lados."],
  },
  {
    id: "flexion_pike", nombre: "Flexión pike", categoria: "empuje",
    resumen: "Flexión con la cadera alta que trabaja los hombros. Base para el pino.",
    musculos: ["Hombros", "Tríceps"],
    pasos: [
      "Desde plancha, sube la cadera formando una V invertida.",
      "Camina con los pies hacia las manos para cargar más los hombros.",
      "Dobla los codos llevando la cabeza hacia el suelo, por delante de las manos.",
      "Empuja de vuelta arriba.",
    ],
    errores: ["Bajar la cadera durante el movimiento.", "Llevar la cabeza entre las manos en vez de adelante."],
    masFacil: "flexion",
  },

  // Tracción
  {
    id: "colgado", nombre: "Colgado en barra", categoria: "traccion",
    resumen: "Desarrolla agarre y salud de hombros. Base de todas las dominadas.",
    musculos: ["Antebrazos", "Espalda", "Hombros"],
    pasos: [
      "Agarra una barra con las palmas hacia adelante, a lo ancho de los hombros.",
      "Si la barra es baja, deja los pies apoyados para quitar algo de peso.",
      "Cuélgate con los brazos estirados y respira tranquilo.",
      "Baja con control cuando termine el tiempo.",
    ],
    errores: ["Soltarte de golpe.", "Aguantar la respiración."],
    masDificil: "escapulares",
  },
  {
    id: "escapulares", nombre: "Retracciones escapulares", categoria: "traccion",
    resumen: "Aprende a activar la espalda colgado, sin doblar los brazos.",
    musculos: ["Espalda alta", "Dorsales"],
    pasos: [
      "Cuélgate de la barra con los brazos estirados.",
      "Sin doblar los codos, tira de los hombros hacia abajo y atrás: el cuerpo sube unos centímetros.",
      "Mantén 1 segundo arriba.",
      "Vuelve lento a colgar relajado.",
    ],
    errores: ["Doblar los codos (debe moverse solo el hombro).", "Balancearte."],
    masFacil: "colgado", masDificil: "dominada_negativa",
  },
  {
    id: "remo_invertido", nombre: "Remo invertido", categoria: "traccion",
    resumen: "La 'flexión al revés'. Usa una barra baja o anillas; más vertical = más fácil.",
    musculos: ["Espalda", "Bíceps", "Hombro posterior"],
    pasos: [
      "Agárrate de una barra a la altura de la cintura (o anillas, o una mesa MUY firme).",
      "Camina con los pies hacia adelante y estira el cuerpo, inclinado hacia atrás.",
      "Tira del pecho hacia la barra juntando los omóplatos.",
      "Baja controlado hasta estirar los brazos.",
    ],
    errores: ["Usar una superficie que se pueda volcar.", "Dejar caer la cadera.", "Tirar con el cuello."],
    masDificil: "dominada_negativa",
  },
  {
    id: "dominada_negativa", nombre: "Dominada negativa", categoria: "traccion",
    resumen: "Sube con ayuda (salto o silla) y baja lo más lento posible. El camino a tu primera dominada.",
    musculos: ["Dorsales", "Bíceps", "Antebrazos"],
    pasos: [
      "Ponte sobre una silla o salta para quedar con el mentón sobre la barra.",
      "Aprieta la espalda y saca el pecho.",
      "Baja durante 3 a 5 segundos hasta estirar los brazos.",
      "Vuelve a subir con ayuda y repite.",
    ],
    errores: ["Caer rápido al final.", "Usar las piernas para frenar."],
    masFacil: "remo_invertido",
  },

  // Piernas
  {
    id: "sentadilla", nombre: "Sentadilla", categoria: "piernas",
    resumen: "El ejercicio de piernas más importante. Siéntate atrás como en una silla.",
    musculos: ["Cuádriceps", "Glúteos", "Isquiotibiales"],
    pasos: [
      "Pies a lo ancho de los hombros, puntas un poco hacia afuera.",
      "Lleva la cadera atrás y abajo, con el pecho erguido.",
      "Baja hasta que los muslos queden paralelos al suelo (o lo que puedas con buena técnica).",
      "Empuja el suelo con todo el pie para subir.",
    ],
    errores: ["Rodillas que se van hacia adentro.", "Levantar los talones.", "Redondear la espalda."],
    masDificil: "sentadilla_bulgara",
  },
  {
    id: "zancada", nombre: "Zancada hacia atrás", categoria: "piernas",
    resumen: "Trabajo a una pierna, más amable con las rodillas que la zancada hacia adelante.",
    musculos: ["Cuádriceps", "Glúteos", "Equilibrio"],
    pasos: [
      "De pie, pies a lo ancho de la cadera.",
      "Da un paso largo hacia atrás y baja la rodilla trasera hacia el suelo.",
      "La rodilla de adelante queda sobre el tobillo.",
      "Empuja con el pie de adelante para volver. Alterna piernas.",
    ],
    errores: ["Inclinar el tronco hacia adelante.", "Golpear la rodilla contra el suelo."],
    masFacil: "sentadilla", masDificil: "sentadilla_bulgara",
  },
  {
    id: "sentadilla_bulgara", nombre: "Sentadilla búlgara", categoria: "piernas",
    resumen: "Zancada con el pie de atrás sobre una silla. Exigente y muy efectiva.",
    musculos: ["Cuádriceps", "Glúteos"],
    pasos: [
      "De espaldas a una silla, apoya el empeine de un pie sobre ella.",
      "Aleja el pie de adelante lo suficiente para bajar cómodo.",
      "Baja recto hasta que el muslo de adelante quede casi paralelo.",
      "Sube empujando con el pie de adelante. Completa un lado y cambia.",
    ],
    errores: ["Pie delantero demasiado cerca de la silla.", "Perder el equilibrio por apurarte."],
    masFacil: "zancada",
  },
  {
    id: "puente_gluteo", nombre: "Puente de glúteo", categoria: "piernas",
    resumen: "Fortalece glúteos y protege la zona lumbar.",
    musculos: ["Glúteos", "Isquiotibiales", "Lumbares"],
    pasos: [
      "Acostado de espaldas, rodillas dobladas y pies apoyados cerca de la cadera.",
      "Aprieta los glúteos y sube la cadera hasta formar una línea rodillas-cadera-hombros.",
      "Mantén 1 segundo arriba.",
      "Baja lento.",
    ],
    errores: ["Arquear la zona lumbar en vez de usar el glúteo.", "Empujar con la punta de los pies."],
  },
  {
    id: "elevacion_talones", nombre: "Elevación de talones", categoria: "piernas",
    resumen: "Pantorrillas y tobillos fuertes. Hazlo en un escalón para más recorrido.",
    musculos: ["Pantorrillas"],
    pasos: [
      "De pie en el borde de un escalón, apoyado en la pared para el equilibrio.",
      "Sube en puntas de pie lo más alto posible.",
      "Mantén 1 segundo y baja lento por debajo del escalón.",
    ],
    errores: ["Rebotar abajo.", "Hacerlo muy rápido."],
  },

  // Core
  {
    id: "plancha", nombre: "Plancha", categoria: "core",
    resumen: "Aguanta el cuerpo recto sobre antebrazos. El core que necesitas para todo lo demás.",
    musculos: ["Abdomen", "Hombros", "Glúteos"],
    pasos: [
      "Antebrazos en el suelo, codos bajo los hombros.",
      "Piernas estiradas, apoyado en las puntas de los pies.",
      "Aprieta glúteos y abdomen; imagina que llevas el ombligo hacia la columna.",
      "Respira normal mientras aguantas.",
    ],
    errores: ["Cadera hundida (duele la espalda baja).", "Cadera muy alta.", "Aguantar la respiración."],
    masDificil: "hollow",
  },
  {
    id: "plancha_lateral", nombre: "Plancha lateral", categoria: "core",
    resumen: "Trabaja los oblicuos y la estabilidad de la cadera.",
    musculos: ["Oblicuos", "Glúteo medio", "Hombros"],
    pasos: [
      "De lado, apoyado sobre el antebrazo con el codo bajo el hombro.",
      "Sube la cadera hasta formar una línea recta de pies a cabeza.",
      "Más fácil: apoya la rodilla de abajo.",
      "Aguanta y luego cambia de lado.",
    ],
    errores: ["Dejar caer la cadera.", "Rotar el tronco hacia el suelo."],
  },
  {
    id: "bicho_muerto", nombre: "Bicho muerto", categoria: "core",
    resumen: "Core profundo sin cargar la espalda. Perfecto para empezar.",
    musculos: ["Abdomen profundo"],
    pasos: [
      "De espaldas, brazos hacia el techo y rodillas dobladas a 90° en el aire.",
      "Pega la zona lumbar al suelo.",
      "Estira lento un brazo hacia atrás y la pierna contraria hacia adelante.",
      "Vuelve al centro y alterna.",
    ],
    errores: ["Despegar la zona lumbar del suelo.", "Moverte rápido."],
    masDificil: "hollow",
  },
  {
    id: "hollow", nombre: "Hollow hold", categoria: "core",
    resumen: "La posición 'banana' de la gimnasia. Clave en calistenia.",
    musculos: ["Abdomen", "Flexores de cadera"],
    pasos: [
      "De espaldas, pega la zona lumbar al suelo.",
      "Levanta hombros y piernas del suelo, brazos estirados junto a las orejas.",
      "Más fácil: rodillas dobladas y brazos hacia las piernas.",
      "Aguanta sin que la espalda baja se despegue.",
    ],
    errores: ["Arquear la espalda baja.", "Tensar el cuello: mira hacia tus pies."],
    masFacil: "bicho_muerto",
  },
  {
    id: "superman", nombre: "Superman", categoria: "core",
    resumen: "Fortalece la espalda baja y la parte posterior del cuerpo.",
    musculos: ["Lumbares", "Glúteos", "Espalda alta"],
    pasos: [
      "Boca abajo con brazos estirados hacia adelante.",
      "Levanta a la vez brazos, pecho y piernas unos centímetros.",
      "Mantén 2 segundos mirando al suelo.",
      "Baja controlado.",
    ],
    errores: ["Levantar la cabeza y mirar al frente.", "Subir con impulso."],
  },
];

const EJERCICIO_POR_ID = Object.fromEntries(EJERCICIOS.map((e) => [e.id, e]));

// Ayudantes para armar las rutinas
const reps = (id, series, n, descanso = 60, porLado = false) =>
  ({ ejercicio: id, series, reps: n, descanso, porLado });
const tiempo = (id, series, segundos, descanso = 45, porLado = false) =>
  ({ ejercicio: id, series, segundos, descanso, porLado });
const calentar = (id) => ({ ejercicio: id, series: 1, segundos: 30, descanso: 10, porLado: false });

const NIVELES = [
  {
    id: 1, nombre: "Fundamentos", semanas: "Semanas 1–3",
    descripcion: "Aprende los movimientos básicos con versiones fáciles. Prioriza la técnica.",
    rutinas: [
      {
        id: "n1a", letra: "A", nombre: "Cuerpo completo A", nivel: 1, enfoque: "Empuje, piernas y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("saltos_tijera"),
          reps("flexion_inclinada", 3, 8),
          reps("sentadilla", 3, 10),
          reps("puente_gluteo", 3, 12, 45),
          tiempo("plancha", 3, 20),
        ],
      },
      {
        id: "n1b", letra: "B", nombre: "Cuerpo completo B", nivel: 1, enfoque: "Tracción, piernas y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("gato_camello"),
          reps("remo_invertido", 3, 6),
          reps("zancada", 3, 6, 60, true),
          tiempo("colgado", 3, 10, 60),
          reps("bicho_muerto", 3, 6, 45, true),
          reps("superman", 3, 8, 45),
        ],
      },
    ],
  },
  {
    id: 2, nombre: "Construcción", semanas: "Semanas 4–6",
    descripcion: "Más volumen y ejercicios nuevos. Tus músculos ya conocen los movimientos.",
    rutinas: [
      {
        id: "n2a", letra: "A", nombre: "Cuerpo completo A", nivel: 2, enfoque: "Empuje, piernas y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("saltos_tijera"),
          reps("flexion_rodillas", 3, 10, 75),
          reps("fondos_banco", 3, 6, 75),
          reps("sentadilla", 3, 15),
          reps("puente_gluteo", 3, 15, 45),
          tiempo("plancha", 3, 30),
        ],
      },
      {
        id: "n2b", letra: "B", nombre: "Cuerpo completo B", nivel: 2, enfoque: "Tracción, piernas y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("gato_camello"),
          reps("escapulares", 3, 8),
          reps("remo_invertido", 3, 10, 75),
          reps("zancada", 3, 10, 60, true),
          tiempo("plancha_lateral", 2, 20, 45, true),
          tiempo("hollow", 3, 15),
        ],
      },
    ],
  },
  {
    id: 3, nombre: "Primeros retos", semanas: "Semana 7 en adelante",
    descripcion: "Flexiones completas, negativas de dominada y trabajo a una pierna.",
    rutinas: [
      {
        id: "n3a", letra: "A", nombre: "Cuerpo completo A", nivel: 3, enfoque: "Empuje, piernas y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("saltos_tijera"),
          reps("flexion", 4, 6, 90),
          reps("fondos_banco", 3, 10, 75),
          reps("sentadilla_bulgara", 3, 8, 75, true),
          reps("elevacion_talones", 3, 15, 45),
          tiempo("hollow", 3, 25),
        ],
      },
      {
        id: "n3b", letra: "B", nombre: "Cuerpo completo B", nivel: 3, enfoque: "Tracción, hombros y core",
        bloques: [
          calentar("circulos_brazos"),
          calentar("gato_camello"),
          reps("dominada_negativa", 4, 3, 90),
          reps("remo_invertido", 3, 12, 75),
          reps("flexion_pike", 3, 6, 75),
          reps("zancada", 3, 12, 60, true),
          tiempo("plancha", 3, 45),
        ],
      },
    ],
  },
];

const RUTINA_POR_ID = Object.fromEntries(NIVELES.flatMap((n) => n.rutinas).map((r) => [r.id, r]));

const CONSEJOS = [
  "Entrena 3 días no consecutivos por semana (por ejemplo lunes, miércoles y viernes).",
  "Alterna la rutina A y la B. La app te sugiere cuál toca.",
  "La técnica va antes que las repeticiones: si se rompe la forma, usa la versión más fácil.",
  "Si no llegas a las repeticiones, no pasa nada. Haz las que puedas con buena forma.",
  "Molestia muscular es normal; dolor articular o punzante no. Detente si algo duele.",
  "Duerme bien, toma agua y come suficiente proteína para recuperarte.",
];

const SENSACIONES = [
  { id: "facil", nombre: "Fácil", emoji: "😎" },
  { id: "bien", nombre: "Bien", emoji: "💪" },
  { id: "dificil", nombre: "Difícil", emoji: "🥵" },
];
