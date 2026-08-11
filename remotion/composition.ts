/**
 * Identidade da composição, isolada de propósito.
 *
 * A rota de download precisa do id para pedir o render, mas importá-lo de
 * `Root.tsx` arrastaria a composição inteira — e os hooks do Remotion, que só
 * funcionam dentro de uma composição — para dentro do bundle do servidor.
 */
export const RECAP_COMPOSITION = 'retro-recap'
