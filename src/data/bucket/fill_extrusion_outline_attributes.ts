import {createLayout} from '../../util/struct_array';

const layout = createLayout([
    {name: 'a_pos',          components: 3, type: 'Int16'},
], 3);

export default layout;
export const {members, size, alignment} = layout;
