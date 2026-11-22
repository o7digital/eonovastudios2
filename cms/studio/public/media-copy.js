export const mediaLabels = {
  logo:'Mi logo',hero:'Inicio',studio:'El estudio',graphic:'Diseño gráfico',digital:'Diseño digital',
};
const descriptions = {
  logo:{es:'EON NOVA Studios',en:'EON NOVA Studios',fr:'EON NOVA Studios'},
  hero:{es:'Imagen principal de EON NOVA Studios',en:'EON NOVA Studios main image',fr:'Image principale de EON NOVA Studios'},
  studio:{es:'El estudio EON NOVA',en:'The EON NOVA studio',fr:'Le studio EON NOVA'},
  graphic:{es:'Diseño gráfico de EON NOVA Studios',en:'Graphic design by EON NOVA Studios',fr:'Design graphique par EON NOVA Studios'},
  digital:{es:'Diseño digital de EON NOVA Studios',en:'Digital design by EON NOVA Studios',fr:'Design digital par EON NOVA Studios'},
};

// Optional editorial descriptions retain their translations; missing values use the placement's known purpose.
export function mediaAlt(placement,lang,value) {
  return typeof value==='string'&&value.trim()?value.trim():descriptions[placement]?.[lang]||'EON NOVA Studios';
}
