import {createLayout} from '../../util/struct_array';

const layout = createLayout([
    {name: 'a_pos',          components: 3, type: 'Int16'},
    {name: 'a_normal_ed',    components: 3, type: 'Int16'},
], 6);

export default layout;
export const {members, size, alignment} = layout;
